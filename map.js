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
        let stations = jsonData.data.stations;
        //console.log('Stations Array:', stations);
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
        const trips = await d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv");
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
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = (arrivals.get(id) ?? 0) + (departures.get(id) ?? 0);
            return station;
        });
        console.log('Stations Array:', stations);
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);
        const svg = d3.select('#map').select('svg');
        const circles = svg
            .selectAll('circle')
            .data(stations)
            .join('circle')
            .attr('r', (d) => radiusScale(d.totalTraffic)) // Radius of the circle
            .attr('fill', 'steelblue') // Circle fill color
            .attr('stroke', 'white') // Circle border color
            .attr('stroke-width', 1) // Circle border thickness
            .attr('opacity', 0.8) // Circle opacity
            .each(function(d) {
                d3.select(this)
                    .append('title')
                    .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,)
            });

        map.on('move', updatePositions); // Update during map movement
        map.on('zoom', updatePositions); // Update during zooming
        map.on('resize', updatePositions); // Update on window resize
        map.on('moveend', updatePositions); // Final adjustment after movement ends
    } 
    catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
});


  
