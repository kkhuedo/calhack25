/**
 * DataSF API Client
 * Fetches data from San Francisco Open Data Portal
 */

export interface DataSFConfig {
  baseUrl: string;
  appToken?: string; // Optional: Get from https://data.sfgov.org/profile/app_tokens
}

export class DataSFClient {
  private readonly baseUrl: string;
  private readonly appToken?: string;

  constructor(config: DataSFConfig) {
    this.baseUrl = config.baseUrl || "https://data.sfgov.org/resource";
    this.appToken = config.appToken;
  }

  /**
   * Fetch all records from a DataSF dataset with pagination
   */
  async fetchDataset<T = any>(
    datasetId: string,
    options: {
      limit?: number;
      offset?: number;
      where?: string;
      select?: string;
      order?: string;
    } = {}
  ): Promise<T[]> {
    const {
      limit = 1000,
      offset = 0,
      where,
      select,
      order,
    } = options;

    const url = new URL(`${this.baseUrl}/${datasetId}.json`);

    // Build query parameters
    url.searchParams.set("$limit", limit.toString());
    url.searchParams.set("$offset", offset.toString());

    if (where) {
      url.searchParams.set("$where", where);
    }

    if (select) {
      url.searchParams.set("$select", select);
    }

    if (order) {
      url.searchParams.set("$order", order);
    }

    const headers: HeadersInit = {
      "Accept": "application/json",
    };

    if (this.appToken) {
      headers["X-App-Token"] = this.appToken;
    }

    console.log(`[DataSF] Fetching from ${datasetId} (limit: ${limit}, offset: ${offset})...`);

    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`DataSF API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[DataSF] Fetched ${data.length} records from ${datasetId}`);

      return data as T[];
    } catch (error) {
      console.error(`[DataSF] Error fetching ${datasetId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all records (handles pagination automatically)
   */
  async fetchAll<T = any>(
    datasetId: string,
    options: {
      where?: string;
      select?: string;
      order?: string;
      batchSize?: number;
      maxRecords?: number;
    } = {}
  ): Promise<T[]> {
    const {
      batchSize = 5000,
      maxRecords = 1000000,
      ...otherOptions
    } = options;

    const allRecords: T[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && allRecords.length < maxRecords) {
      const batch = await this.fetchDataset<T>(datasetId, {
        ...otherOptions,
        limit: batchSize,
        offset,
      });

      if (batch.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...batch);
        offset += batchSize;

        // Rate limiting - be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[DataSF] Total records fetched from ${datasetId}: ${allRecords.length}`);
    return allRecords;
  }

  /**
   * Count total records in a dataset
   */
  async count(datasetId: string, where?: string): Promise<number> {
    const url = new URL(`${this.baseUrl}/${datasetId}.json`);
    url.searchParams.set("$select", "count(*)");

    if (where) {
      url.searchParams.set("$where", where);
    }

    const headers: HeadersInit = {
      "Accept": "application/json",
    };

    if (this.appToken) {
      headers["X-App-Token"] = this.appToken;
    }

    try {
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        throw new Error(`DataSF API error: ${response.status}`);
      }

      const data = await response.json();
      return parseInt(data[0].count);
    } catch (error) {
      console.error(`[DataSF] Error counting ${datasetId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const dataSFClient = new DataSFClient({
  baseUrl: "https://data.sfgov.org/resource",
  appToken: process.env.DATASF_APP_TOKEN, // Optional
});
