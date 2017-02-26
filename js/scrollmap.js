// scrollmap.js: leaflet-based raster exploration app
// Raster project/unproject libraries: https://github.com/commenthol/leaflet-rastercoords
// NOTE: This script relies on ControlMiniMap.js: https://github.com/Norkart/Leaflet-MiniMap
// but has had five small edits required for percentage widths and clicking on minimap markers. 
// Persist changes if ControlMiniMap.js is upgraded.

var map;
var miniMap;
var mainMapMarkers = [];
var miniMapOptions;

$(document).ready(function() {

  // *** Main map ***
  
  map = L.map('map', {
    minZoom: mapMinZoom, 
    maxZoom: mapMaxZoom, 
    closePopupOnClick: false,
    attributionControl: false
  });
  
  // assign map and image dimensions
  var rc = new L.RasterCoords(map, img);
  var centerLatLng = rc.unproject(centerRaster);
  var startSWLatLng = rc.unproject(startSW);
  var startNELatLng = rc.unproject(startNE);
  var popupToOpen = null;
  
  map.on('load', function() {
    adjustMiniMap();
  });
  
  map.on('resize', function() {
    clearTimeout(window.resizedFinished);
    window.resizedFinished = setTimeout(function() {
      adjustMiniMap();
    }, 500);
  });
  
  map.on('moveend', function() {
    if (popupToOpen != null) {
      openMapPopup(popupToOpen);
    }
    popupToOpen = null;
  });

  // Initial conditions. Event listeners need to be defined before initial view is set.
  map.fitBounds([startSWLatLng, startNELatLng], {
    maxZoom: mapMaxZoom - 3
  });
  
  // the tile layer containing the image generated with gdal2tiles --leaflet ...
  L.tileLayer(rasterUrl, {
    noWrap: true,
    attribution: rasterAttrib
  }).addTo(map);
  map.addControl(L.control.attribution({
    position: 'bottomright',
    prefix: false
  }));


  // *** Place markers ***
  
  var placePopupOptions = {
    // popup customization here
  }
  
  var iconSize = [29, 45];
  var popupoffset = [1, -25];
  var mapIconOptions = {
    iconUrl: 'img/markers-red.png',
    shadowUrl: 'img/markers-shadow.png',
    iconSize:     iconSize, // size of the icon
    shadowSize:   [45, 27], // size of the shadow
    iconAnchor:   [iconSize[0]/2, iconSize[1]], // point of the icon which will correspond to marker's location
    shadowAnchor: [4, 27],  // the same for the shadow
    popupAnchor:  popupoffset // point from which the popup should open relative to the iconAnchor
  };

  function mapPointToLayer(placePoint, placeLatLng) {
    var iconOptionsSpecial = {
      iconUrl: 'img/markers-' + placePoint.properties["icon-color"] + '.png', 
    };
    var iconOptions = $.extend({}, mapIconOptions, iconOptionsSpecial);
    var markerIcon = L.icon(iconOptions);
    var unprojectedLatLng = rc.unproject([placeLatLng.lng, placeLatLng.lat]);
    var placeMarker = L.marker(unprojectedLatLng, {
      icon: markerIcon,
      title: placePoint.properties["title"]
    });
    return placeMarker;
  }

  function onEachMapFeature(feature, layer) {
    var content = '';
    if (feature.properties) {
      if (feature.properties.title) {
        content += '<div class="header2">' + feature.properties.title + '</div>';
      }
      if (feature.properties.content) {
        content += '<div class="place-content">' + feature.properties.content + '</div>';
      }
    }
    layer.bindPopup(content, placePopupOptions);
    mainMapMarkers.push(layer);
  }
  
  var mapPlaceOptions = {
    pointToLayer: mapPointToLayer,
    onEachFeature: onEachMapFeature
  };
  
  var scrollMarkers = L.geoJSON(places, mapPlaceOptions);
  scrollMarkers.addTo(map);

  // Layer control for the place markers
  var overlays = {
		"Markers": scrollMarkers
	};
  L.control.layers({}, overlays, {
    //position: 'topleft'
  }).addTo(map);

// coordinate finder for development - just outputting to console
  map.on('click', function (event) {
    var coords = rc.project(event.latlng)
    var popupText = '[' + Math.floor(coords.x) + ',' + Math.floor(coords.y) + ']'
    + ' (' + event.latlng.lng + ',' + event.latlng.lat + ')';
    console.log(popupText);
  });
  

  // *** Minimap ***
  
  function setMiniMapOptions() {
    if (typeof miniMapOptions === 'undefined') {
      miniMapOptions = {
        zoomLevelFixed: miniMapZoom,
        toggleDisplay: true,
        width: '100%',
        height: miniMapHeight,
        mapOptions: {
          doubleClickZoom: false
        }
      };
    }
  }
  
  function addMiniMap() {
    setMiniMapOptions();
    $('.leaflet-bottom.leaflet-right').css('min-width', fixedMiniMapMinWidth);
    miniMap = new L.Control.MiniMap(miniMapLayerGroup, miniMapOptions).addTo(map);
  }

  function adjustMiniMap() {
    setMiniMapOptions();
    var mapWidth = map._size.x;
    if (mapWidth < minWidthForMiniMap) {
      // make minimap pannable
      delete(miniMapOptions['centerFixed']);
    } else {
      // make minimap fixed
      miniMapOptions['centerFixed'] = centerLatLng;
    }
    
    // Resizing window. Set options, and destroy and re-instantiate miniMap.
    if (typeof miniMap !== 'undefined') {
      miniMap.remove();
      addMiniMap();
    }
  }
  
  var miniMapBasemap = L.tileLayer(rasterUrl, {
    noWrap: true,
    minZoom: miniMapZoom,
    maxZoom: miniMapZoom,
    attribution: rasterAttrib
  });
  
  function openMapPopup(id) {
    for (var i in mainMapMarkers) {
      var markerID = mainMapMarkers[i].options.title;
      if (markerID == id){
        mainMapMarkers[i].openPopup();
      };
    }
  }
  
  function miniMapPointToLayer(placePoint, placeLatLng) {
    var iconOptionsSpecial = {
      iconUrl: 'img/markers-' + placePoint.properties["icon-color"] + '.png', 
    };
    var iconOptions = $.extend({}, mapIconOptions, iconOptionsSpecial);
    var markerIcon = L.icon(iconOptions);
    var unprojectedLatLng = rc.unproject([placeLatLng.lng, placeLatLng.lat]);
    var placeMarker = L.marker(unprojectedLatLng, {
      icon: markerIcon,
      title: placePoint.properties["title"]
    });
    return placeMarker;
  }
  
  function onEachMiniMapFeature(feature, layer) {
    layer.on('click', function(e) {
      popupToOpen = layer.options.title;
      map.flyTo(layer._latlng);
    });
  }

  var miniMapPlaceOptions = {
    pointToLayer: miniMapPointToLayer,
    onEachFeature: onEachMiniMapFeature
  };
  
  var miniMapMarkers = L.geoJSON(places, miniMapPlaceOptions);

  var miniMapLayerGroup = L.layerGroup([
    miniMapBasemap,
    miniMapMarkers
  ]);
  
  addMiniMap();

});
