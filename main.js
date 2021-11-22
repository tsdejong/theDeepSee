// theDeepSee WQM App

// Styling Parameters:

// Map Colors:
var pallet1 = ['040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
    '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
    '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
    'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
    'ff0000', 'de0101', 'c21301', 'a71001', '911003'];
var pallet2 = pallet1.reverse();
var pallet9 = ['aa4465','861657', '175676', '4ba3c3', 'ddfff7', '#FFFFFF'];
var pallet10 = ['aa4465','861657', '175676', '4ba3c3', 'ddfff7', '#FFFFFF'];
var pallet11 = ['ae2012', 'bb3e03', 'ca6702', 'ee9b00', 'e9d8a6', '94d2bd', '0a9396', '005f73', '001219'];
var pallet_griffins = ['#022d21', '#064a38', '#175676', '#4ba3c3', '#ddfff7'];
var pallet12 = ['ae2012', 'ca6702', 'ee9b00', 'e9d8a6', '94d2bd', '#175676', '161b33'];
var pallet = pallet12;

// Basemap Style
var mapStyle = [
  {stylers: [{saturation: -100}]},
  {elementType:'labels', stylers:[{visibility: 'on'}]},
  {featureType: 'road', stylers:[{visibility: 'off'}]}
  ];

// Sidebar Styling:
var headerTextColor = '#FFFFFF';
var minorHeaderTextColor = '#000000'
var headerBGColor1 = '#175676';   // Will try to change it to this later
var headerBGColor2 = '#365574';
var minorHeaderBGColor = '#FFFFFF';
var sidebarBGColor = '#FFFFFF';

// Chart Styling:
var chart1LineColor = 'ed6a5e';
var chart2Line1Color = '9cc5a1';
var chart2Line2Color = 'ed6a5e';
var chart2Line3Color = 'eddea4';

// Font:
var fontStyle = 'Arial';


// COMPUTE DEFAULT MAP AT POINT OF INITIAL LAUNCH

// DEFINE INITIAL DEFAULT PARAMETERS
var dateEnd = new Date();
dateEnd = dateEnd.getFullYear()+'-'+(dateEnd.getMonth()+1)+'-'+dateEnd.getDate(); // current date
var getStartDate = function (timePeriodDays) {
  var dateStart = new Date();
  dateStart.setDate(dateStart.getDate()-timePeriodDays);
  dateStart = dateStart.getFullYear()+'-'+(dateStart.getMonth()+1)+'-'+dateStart.getDate(); // subtract one week
  return dateStart
  };
var dateStartDay = getStartDate(2);
var dateStartWeek = getStartDate(7);


// INITIALIZE POI
var lonPlaceholder = -123.58;
var latPlaceholder =  49.16;
var point = ee.Geometry.Point(lonPlaceholder, latPlaceholder).buffer(1e3);


// INITIALIZE DATE RANGE
var dateRange = ee.DateRange(dateStartWeek, dateEnd);

// IMPORT AND FILTER INITIAL DATA
var S3 = ee.ImageCollection('COPERNICUS/S3/OLCI')
                  .sort('system:time_start')
                  .select(['Oa04_radiance', 'quality_flags']);

// MASK LAND AND CLOUD                  
//Create functions to mask land from mosaic
var getQABits = function(image, start, end, newName) {
    // Compute the bits we need to extract.
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    // Return a single band image of the extracted QA bits, giving the band a new name.
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};
// A function to mask out land and cloud pixels.
var land_pixels = function(image) {
  // Select the QA band.
  var qf = image.select(['quality_flags']);
  // Get the bit that flags land.
  return getQABits(qf, 31,31, 'Land_pixels').eq(0);
  // Return an image masking out cloudy areas.
};
var maskLand = function(image) {
  var lp = land_pixels(image);
  image = image.updateMask(lp);
  return image;
};
S3 = S3.map(maskLand); // Apply mask
                  
                
// APPLY MODEL
var modelV1 = function(image) {
  var addSDD = image.expression(
    '2.39 * ((0.0115198 * KD490) ** (-0.86))', {
      'KD490': image.select('Oa04_radiance')
    }).rename('SDD'); 
  return image.addBands(addSDD);
};  
var SDD = S3.map(modelV1);
SDD = SDD.select('SDD'); // remove 'Oa04_radiance' and 'quality flags' band


// INITIALIZE & CONFIGURE MAP
var mapPanel = ui.Map();
mapPanel.setControlVisibility(false);
var layers = mapPanel.layers();
var visArgs = {
  min: 0,
  max: 4,
  palette: pallet,
  opacity: 0.8,
  };
mapPanel.style().set('cursor', 'crosshair');
mapPanel.centerObject(point, 7.5);
mapPanel.setOptions('Grey', {'Grey': mapStyle});

// CREATE CHART FROM POINT AND DATERANGE
var getChart = function (point, dateRange) {
  
  var sddSelected = SDD.filterBounds(point).filterDate(dateRange);
  var sddDOY = SDD.filterBounds(point).filterDate('2019-01-01', dateEnd);
  var startDOY = dateRange.start().getRelative('day','year');
  var endDOY = dateRange.end().getRelative('day','year');

  // Current Selected SDD Chart
  var sddChart = ui.Chart.image.series({
    imageCollection: sddSelected,
    region: point,
    reducer: ee.Reducer.mean(),
    scale: 500
    }).setOptions({
    title: 'SDD Measurements for Selected Location',
    vAxis: {title: 'SDD (m)', fontFamily: fontStyle},
    hAxis: {
      title: 'Date',
      format: 'MM-yy-dd',
      gridlines: {
        count: -1,
        units: {
        days: {format: ['MMM dd']},
        hours: {format: ['HH:mm', 'ha']},
        }},
      fontFamily: fontStyle
      },
    series: {0:{lineWidth: 3, color: chart1LineColor, pointSize: 3}},
    interpolateNulls: true
    });
  // Add the chart at a fixed position, so that new charts overwrite older ones.
  chartPanel.widgets().set(0, sddChart);
  
  // DOY Chart
  var sddChartDOY = ui.Chart.image.doySeriesByYear({
    imageCollection: sddDOY,
    bandName: 'SDD',
    region: point,
    regionReducer: ee.Reducer.mean(),
    scale: 500,
    sameDayReducer: ee.Reducer.mean(),
    startDay: startDOY,
    endDay: endDOY
    })
    .setOptions({
      title: 'Yearly Comparison',
      hAxis: {title: 'Day of Year', fontFamily: fontStyle},
      vAxis: {title: 'SDD (m)', fontFamily: fontStyle},
      lineWidth: 5,
      series: {
        0:{lineWidth: 3, color: chart2Line1Color, pointSize: 3},
        1:{lineWidth: 3, color: chart2Line2Color, pointSize: 3},
        2:{lineWidth: 3, color: chart2Line3Color, pointSize: 3}
        }
      });
      
    chartPanel.widgets().set(1, sddChartDOY);
    };
  
  
  
  
// CREATE MAP FROM POINT AND DATERANGE

var getMap = function (point, dateRange) {
  var sddVis = SDD.filterDate(dateRange).select('SDD').mean();
  sddVis = sddVis.visualize(visArgs);
  var sddVisLayer = ui.Map.Layer(sddVis).setName(dateRange.toString());
  layers.set(0, sddVisLayer);
  };

// GENARATES POINT WHEN CLICKING MAP
var getPoint = function (coords) {
  // Update the lon/lat panel with values from the click event.
  lon.setValue(coords.lon.toFixed(2));
  lat.setValue(coords.lat.toFixed(2));
  lonText.setValue(coords.lon.toFixed(2));
  latText.setValue(coords.lat.toFixed(2));
  
  // Add a dot for the point clicked on.
  point = ee.Geometry.Point(coords.lon, coords.lat).buffer(1e3);
  var dot = ui.Map.Layer(point, {color: '000000'}, 'clicked location');
  // Add the dot as the second layer, so it shows up on top of the composite.
  mapPanel.layers().set(1, dot);
  };



/*
 * SETUP PANELS AND WIDGETS
 */

// Intro and Search Filter Panel

// Header and logo
var logo1 = ee.Image("users/T7dejong/logoV1_rast_trans").visualize({
    bands:  ['b1', 'b2', 'b3'],
    min: 0,
    max: 255
    });
var logo2 = ee.Image("users/T7dejong/logo1V2_rast_trans").visualize({
    bands:  ['b1', 'b2', 'b3'],
    min: 0,
    max: 255
    });
    
var logo3 = ee.Image("users/T7dejong/logo1V2_9_rast_trans").visualize({
    bands:  ['b1', 'b2', 'b3'],
    min: 0,
    max: 255
    });

var logo4 = ee.Image("users/T7dejong/logo1V2_10_rast_trans").visualize({
    bands:  ['b1', 'b2', 'b3'],
    min: 0,
    max: 255
    });


var thumb = ui.Thumbnail({
    image: logo4,
    params: {
        dimensions: '1360x340',
        format: 'png'
        },
    style: {height: '40px', width: '160px', padding :'0', backgroundColor: headerBGColor2}
    });    
    
var inspectorPanel = ui.Panel({style: {width: '22%', backgroundColor: sidebarBGColor}});

// Intro Panel
var header = ui.Panel({
  widgets: [thumb],
  style: {backgroundColor: headerBGColor2}
  });
inspectorPanel.add(header);
var intro = ui.Panel([
  ui.Label({
    value: 'Secchi Disk Depth (SDD) is the maximum distance that \
    can be seen through a water source from its surface. Using daily \
    updated satellite imagery at 300m resolution, theDeepSee applies machine learning \
    models to predict SDD at a global scale. Model predictions have a \
    Rsq and RMSE of 0.89 and 0.77 m respectively. Please \
    follow the directions below for your search and contact \
    thedeepsee@gmail.com for any enquries.',
    style: {fontFamily: fontStyle}  
  }),
  ui.Label({value: '1. Select point of interest on map', style: {fontWeight: 'bold', backgroundColor: minorHeaderBGColor, fontFamily: fontStyle}})
]);
inspectorPanel.add(intro);



// 1. Location Panel
var lon = ui.Label();
var lat = ui.Label();
var lonLabel = ui.Label('lon');
var lonText = ui.Textbox({
  placeholder: 'LON',
  onChange: function(text) {
    lon.setValue(text);
  },
  style: {width: '42.5%'}
});
var latLabel = ui.Label('lat');
var latText = ui.Textbox({
  placeholder: 'LAT',
  onChange: function(text) {
    lat.setValue(text);
  },
  style: {width: '42.5%'}
});

var locPanel = ui.Panel([
  lonText,
  latText
  ],
  ui.Panel.Layout.flow('horizontal')
  );
inspectorPanel.add(locPanel);


// 2. Date Range Selection Panel
inspectorPanel.add(ui.Label({value: '2. Select date range', style: {fontWeight: 'bold', backgroundColor: minorHeaderBGColor, fontFamily: fontStyle}}));

// Select Date: Slider
var getDateSlide = ui.DateSlider({
  start: '2017-01-01',
  value: dateEnd,
  onChange: function(range) {
    dateRange = ee.DateRange(range);
    },
  style: {width: '90%'}
  });
  
// Select Date Range Type: Dropdown
var getDateRangeType = ui.Select({
  items: [
    {label: 'Daily', value: 2},
    {label: 'Weekly', value: 7},
    {label: 'Monthly', value: 30},
    {label: 'Yearly', value: 365}
  ],
  value: 2,
  onChange: function(value) {
    getDateSlide.setPeriod(value);
    },
  style: {width: '90%'}});


inspectorPanel.add(getDateRangeType);
inspectorPanel.add(getDateSlide);



// CLICKING MAP CALLBACK
mapPanel.onClick(getPoint);


// 3. Panel for loading results
inspectorPanel.add(ui.Label({value: '3. Load Results', style: {fontWeight: 'bold', backgroundColor: minorHeaderBGColor, fontFamily: fontStyle}}));

// Add load button
var loadButton = ui.Button({
  label: 'Search',
  onClick: function() {
    var lonVal = parseFloat(lonText.getValue());
    var latVal = parseFloat(latText.getValue());
    if (isNaN(lonVal) || isNaN(latVal) || latVal > 73.15 || latVal < -49.29) {
      errorMessage.setValue('ERROR: Please enter a valid location.')
    } else {
      point = ee.Geometry.Point(lonVal, latVal).buffer(1e3);
      getChart(point, dateRange);
      getMap(point, dateRange);
      errorMessage.setValue('')
    }
  },
  style: {width: '90%'}
  });
inspectorPanel.add(loadButton)

// Error Bar
var errorMessage = ui.Label({
  style: {fontWeight: 'bold', color: 'red'}
});
var errorPanel = ui.Panel({
  widgets: [errorMessage]
  });
inspectorPanel.add(errorPanel);


// Chart Panel
var chartPanel = ui.Panel();
chartPanel.style().set({
  width: '450px',
  position: 'top-right'
});
mapPanel.add(chartPanel);


// CREATE LEGEND

// Creates a color bar thumbnail image for use in legend from the given color
// palette.
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}
// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(visArgs.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});
// Create a panel with three numbers for the legend.
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(visArgs.min, {margin: '4px 8px'}),
    ui.Label(
        (visArgs.max / 2),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(visArgs.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});
var legendTitle = ui.Label({
  value: 'Map Legend: mean SDD (m)',
  style: {fontWeight: 'bold', fontFamily: fontStyle}
});
var legendPanel = ui.Panel({widgets: [legendTitle, colorBar, legendLabels], style: {width: '25%', position:  'bottom-right'}});
mapPanel.add(legendPanel)




// INITIALIZE APP

getMap(point, dateRange);
getChart(point, dateRange);


// Replace the root with a SplitPanel that contains the inspector and map.
ui.root.clear();
ui.root.add(ui.SplitPanel(inspectorPanel, mapPanel));