import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
mapboxgl.accessToken = 'pk.eyJ1IjoiOTUwMjQyNTYiLCJhIjoiY21ha2FxNWU5MDdidDJrcTQ1enk0ZnQ0ayJ9.7oOZzBnYU9CkSpZeg9Shkg';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations,trips){
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id,
    );
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id,
    );
    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0);
        return station;
    });
}

function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1
      ? trips // If no filter is applied (-1), return all trips
      : trips.filter((trip) => {
          // Convert trip start and end times to minutes since midnight
          const startedMinutes = minutesSinceMidnight(trip.started_at);
          const endedMinutes = minutesSinceMidnight(trip.ended_at);
  
          // Include trips that started or ended within 60 minutes of the selected time
          return (
            Math.abs(startedMinutes - timeFilter) <= 60 ||
            Math.abs(endedMinutes - timeFilter) <= 60
          );
    });
}

map.on('load', async () => {
    // Bike Lines
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });
    map.addLayer({
        id: 'bike-lanes-boston',
        type: 'line',
        source: 'boston_route',
        paint: {
          'line-color': 'green',
          'line-width': 3,
          'line-opacity': 0.4,
        },
      });
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
    });
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: {
          'line-color': 'green',
          'line-width': 3,
          'line-opacity': 0.4,
        },
    });
    // Bike Stations
    let jsonData;
    console.log("hi");
    try {
        const jsonurl ="https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
    
        //console.log('Loaded JSON Data:', jsonData); // Log to verify structure
        let trips = await d3.csv(
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
            (trip) => {
              trip.started_at = new Date(trip.started_at);
              trip.ended_at = new Date(trip.ended_at);
              return trip;
            },
        );
        
        const stations = computeStationTraffic(jsonData.data.stations, trips);
        console.log(stations)
        computeStationTraffic(stations,trips);
        console.log('Stations Array:', stations);
        // D3
        function getCoords(station) {
            const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
            const { x, y } = map.project(point); // Project to pixel coordinates
            return { cx: x, cy: y }; // Return as object for use in SVG attributes
        }
        function updatePositions() {
            circles
              .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
              .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
        }
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
        const svg = d3.select('#map').select('svg');
        let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

        const circles = svg
            .selectAll('circle')
            .data(stations, (d) => d.short_name)
            .join('circle')
            .attr('r', (d) => radiusScale(d.totalTraffic)) // Radius of the circle
            .attr('fill', 'steelblue') // Circle fill color
            .attr('stroke', 'white') // Circle border color
            .attr('stroke-width', 1) // Circle border thickness
            .attr('opacity', 0.8) // Circle opacity
            .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),
            )
            .each(function(d) {
                d3.select(this)
                    .append('title')
                    .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,)
            });

        map.on('move', updatePositions); // Update during map movement
        map.on('zoom', updatePositions); // Update during zooming
        map.on('resize', updatePositions); // Update on window resize
        map.on('moveend', updatePositions); // Final adjustment after movement ends
        let timeFilter;
        //const timeSlider = document.getElementById('#time-slider');
        const timeSlider = document.querySelector('input');
        //const selectedTime = document.getElementById('#selected-time');
        const selectedTime = document.querySelector('em');
        //const anyTimeLabel = document.getElementById('#any-time');
        const anyTimeLabel = document.querySelector('time');

        function updateTimeDisplay() {
            timeFilter = Number(timeSlider.value); // Get slider value
          
            if (timeFilter === -1) {
              selectedTime.textContent = ''; // Clear time display
              anyTimeLabel.style.display = 'block'; // Show "(any time)"
            } else {
              selectedTime.textContent = formatTime(timeFilter); // Display formatted time
              anyTimeLabel.style.display = 'none'; // Hide "(any time)"
            }
          
            updateScatterPlot(timeFilter);
          }
        console.log(timeSlider);
        
        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();

        function updateScatterPlot(timeFilter) {
            // Get only the trips that match the selected time filter
            const filteredTrips = filterTripsbyTime(trips, timeFilter);
          
            // Recompute station traffic based on the filtered trips
            const filteredStations = computeStationTraffic(stations, filteredTrips);
            
            timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
            // Update the scatterplot by adjusting the radius of circles
            circles
               .data(filteredStations, (d) => d.short_name)
              .join('circle') // Ensure the data is bound correctly
              .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
              .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),);
        }

        



    } 
    catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
});


  
