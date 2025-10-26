/**
 * Test script for Parking Availability API
 *
 * Usage:
 * node --env-file=.env test-parking-api.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Test locations in San Francisco
const TEST_LOCATIONS = {
  financialDistrict: {
    name: 'Financial District',
    latitude: 37.7946,
    longitude: -122.3999,
  },
  missionDistrict: {
    name: 'Mission District',
    latitude: 37.7599,
    longitude: -122.4148,
  },
  downtownSF: {
    name: 'Downtown SF',
    latitude: 37.7749,
    longitude: -122.4194,
  },
};

async function testParkingAvailability(locationKey, radius = 500) {
  const location = TEST_LOCATIONS[locationKey];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🅿️  Testing: ${location.name}`);
  console.log(`📍 Location: ${location.latitude}, ${location.longitude}`);
  console.log(`📏 Radius: ${radius}m`);
  console.log('='.repeat(60));

  const url = `${BASE_URL}/api/parking-availability?` +
    `latitude=${location.latitude}&` +
    `longitude=${location.longitude}&` +
    `radius=${radius}`;

  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return;
    }

    const data = await response.json();

    // Display summary
    console.log(`\n⏱️  Response Time: ${responseTime}ms`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Available Spots: ${data.summary.totalAvailableSpots}`);
    console.log(`   Confidence Score: ${(data.summary.confidenceScore * 100).toFixed(0)}%`);
    console.log(`\n💡 RECOMMENDATIONS:`);
    data.summary.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    // Display user-reported spots
    console.log(`\n👥 USER-REPORTED SPOTS: ${data.sources.userReported.length}`);
    if (data.sources.userReported.length > 0) {
      data.sources.userReported.slice(0, 3).forEach((spot, i) => {
        console.log(`   ${i + 1}. ${spot.address}`);
        console.log(`      Distance: ${Math.round(spot.distance)}m`);
        console.log(`      Status: ${spot.status}`);
        console.log(`      Confidence: ${(spot.confidence * 100).toFixed(0)}%`);
        console.log(`      Posted: ${new Date(spot.postedAt).toLocaleString()}`);
        if (spot.notes) console.log(`      Notes: ${spot.notes}`);
      });
    }

    // Display SFpark data
    console.log(`\n🏙️  SFPARK SEGMENTS: ${data.sources.sfpark.length}`);
    if (data.sources.sfpark.length > 0) {
      data.sources.sfpark.slice(0, 3).forEach((segment, i) => {
        console.log(`   ${i + 1}. ${segment.address}`);
        console.log(`      Distance: ${Math.round(segment.distance)}m`);
        console.log(`      Total Spaces: ${segment.totalSpaces}`);
        console.log(`      Metered: ${segment.regulations.metered ? 'Yes' : 'No'}`);
        console.log(`      Hours: ${segment.regulations.hours || 'N/A'}`);
      });
    }

    // Display Google Places data
    console.log(`\n🅿️  GOOGLE PLACES: ${data.sources.googlePlaces.length}`);
    if (data.sources.googlePlaces.length > 0) {
      data.sources.googlePlaces.slice(0, 3).forEach((place, i) => {
        console.log(`   ${i + 1}. ${place.name}`);
        console.log(`      Type: ${place.type}`);
        console.log(`      Distance: ${Math.round(place.distance)}m`);
        console.log(`      Paid: ${place.parkingOptions.paid ? 'Yes' : 'No'}`);
        console.log(`      Free: ${place.parkingOptions.free ? 'Yes' : 'No'}`);
        if (place.rating) console.log(`      Rating: ${place.rating}⭐`);
      });
    } else {
      console.log(`   (Google Places API not configured or no results)`);
    }

    // Display prediction
    console.log(`\n🔮 PREDICTION:`);
    if (data.sources.predictions.length > 0) {
      const pred = data.sources.predictions[0];
      console.log(`   Probability Available: ${(pred.probabilityAvailable * 100).toFixed(0)}%`);
      console.log(`   Recommendation: ${pred.recommendation}`);
      console.log(`   Factors:`);
      console.log(`      Time of Day: ${(pred.factors.timeOfDay * 100).toFixed(0)}%`);
      console.log(`      Day of Week: ${(pred.factors.dayOfWeek * 100).toFixed(0)}%`);
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

async function testAllLocations() {
  console.log('\n🚀 Starting Parking API Tests...\n');

  // Test health endpoint
  console.log('Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const health = await response.json();
    console.log(`✅ Health Check: ${health.status} - Database: ${health.database}\n`);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.error('   Make sure server is running: npm run dev\n');
    return;
  }

  // Test each location
  for (const locationKey of Object.keys(TEST_LOCATIONS)) {
    await testParkingAvailability(locationKey, 500);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All tests completed!');
  console.log(`${'='.repeat(60)}\n`);
}

// Run tests
testAllLocations().catch(console.error);
