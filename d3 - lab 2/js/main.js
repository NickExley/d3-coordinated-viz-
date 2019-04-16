//create anonymous function to hold all other functions
(function(){

	//set global variables for the attribute array and which attribute is expressed 
	var attrArray = ["Highschool Graduation Rate", "Highschool Graduate Median Earnings", "College Graduation Rate", "College Graduate Median Earnings", "Graduate Degree Rate", "Grad School Graduate Median Earnings"];
	var expressed = attrArray[0];
	
		//chart frame dimensions
	var chartWidth = window.innerWidth * 0.42
		chartHeight = 473,
		leftPadding = 35,
		rightPadding = 2,
		topBottomPadding = 5,
		chartInnerWidth = chartWidth - leftPadding - rightPadding,
		chartInnerHeight = chartHeight - topBottomPadding * 2,
		translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
		
	//create a scale to size bars proportionally to frame
	var yScale = d3.scaleLinear()
		.range([chartHeight, 0])
		.domain([0, 105]);

	//begin script when window loads
	window.onload = setMap();

	//set up choropleth map
	function setMap(){
		
		//map frame dimensions
		var width = window.innerWidth * 0.5,
			height = 460;

		//create new svg container for the map
		var map = d3.select("body")
			.append("svg")
			.attr("class", "map")
			.attr("width", width)
			.attr("height", height);

		//create Albers equal area conic projection centered on New Mexico
		var projection = d3.geoAlbers()
		.center([2, 34.25])
		.rotate([108.27, -0.00, 0])
		.parallels([45, 60])
		.scale(4400)
		.translate([width / 2, height / 2]);
		
		var path = d3.geoPath()
		  .projection(projection);
		
		//use Promise.all to parallelize asynchronous data loading
		var promises = [];
		promises.push(d3.csv("data/new_mexico_education.csv")); //load attributes from csv
		promises.push(d3.json("data/us_states_limited.topojson")); //load background spatial data
		promises.push(d3.json("data/new_mexico_limited.topojson")); //load choropleth spatial data
		Promise.all(promises).then(callback);

		function callback(data){
			csvData = data[0];
			states = data[1];
			newMexico = data[2];
			
			//translate states & new mexico TopoJSON
			var usStates = topojson.feature(states, states.objects.us_states_limited),
			newMexico = topojson.feature(newMexico, newMexico.objects.new_mexico_limited).features;
			
			//add US states to map
			var states = map.append("path")
				.datum(usStates)
				.attr("class", "states")
				.attr("d", path);
			
			newMexico = joinData(newMexico, csvData);
			
			colorScale = makeColorScale(csvData);
			
			setEnumerationUnits(newMexico, map, path, colorScale);
			
			setChart(csvData, colorScale);
			
			createDropdown()
			
			setLabel(expressed)
		};
	};

	function setGraticule(map, path){
		//create graticule generator
		var graticule = d3.geoGraticule()
			.step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude
			
		//create graticule background
		var gratBackground = map.append("path")
			.datum(graticule.outline()) //bind graticule background
			.attr("class", "gratBackground") //assign class for styling
			.attr("d", path) //project graticule
		
		//create graticule lines
		var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
			.data(graticule.lines()) //bind graticule lines to each element to be created
			.enter() //create an element for each datum
			.append("path") //append each element to the svg as a path element
			.attr("class", "gratLines") //assign class for styling
			.attr("d", path); //project graticule lines
	};
	
	//function to join the data from csv file to the topojson files 
	function joinData(newMexico, csvData){
		//variables for data join
		var attrArray = ["Highschool Graduation Rate", "Highschool Graduate Median Earnings", "College Graduation Rate", "College Graduate Median Earnings", "Graduate Degree Rate", "Grad School Graduate Median Earnings"];

		//loop through csv to assign each set of csv attribute values to geojson region
		for (var i=0; i<csvData.length; i++){
			var csvCounties = csvData[i]; //the current region
			var csvKey = csvCounties.CountyFP; //the CSV primary key

			//loop through geojson regions to find correct region
			for (var a=0; a<newMexico.length; a++){

				var geojsonProps = newMexico[a].properties; //the current region geojson properties
				var geojsonKey = geojsonProps.COUNTYFP; //the geojson primary key

				//where primary keys match, transfer csv data to geojson properties object
				if (parseInt(geojsonKey) == parseInt(csvKey)){

					//assign all attributes and values
					attrArray.forEach(function(attr){
						var val = parseFloat(csvCounties[attr]); //get csv attribute value
						geojsonProps[attr] = val; //assign attribute and value to geojson properties
					});
				};
			};
		};
		return newMexico;
	};
	
	//function to create a dropdown menu for attribute selection
	function createDropdown(csvData){
		//add select element
		var dropdown = d3.select("body")
			.append("select")
			.attr("class", "dropdown")
			.on("change", function(){
				changeAttribute(this.value, csvData)
			});


		//add initial option
		var titleOption = dropdown.append("option")
			.attr("class", "titleOption")
			.attr("disabled", "true")
			.text("Select Attribute");

		//add attribute name options
		var attrOptions = dropdown.selectAll("attrOptions")
			.data(attrArray)
			.enter()
			.append("option")
			.attr("value", function(d){ return d })
			.text(function(d){ return d });
	};
	
	//dropdown change listener handler
	function changeAttribute(attribute, data){
		//change the expressed attribute
		expressed = attribute;

		//recreate the color scale
		var colorScale = makeColorScale(csvData);

		//recolor enumeration units
		var counties = d3.selectAll(".counties")
			.transition()
			.duration(1000)
			.style("fill", function(d){
				return choropleth(d.properties, colorScale)
			});
		//re-sort, resize, and recolor bars
		var bars = d3.selectAll(".bar")
			//re-sort bars
			.sort(function(a, b){
				return b[expressed] - a[expressed];
			})
			.transition() //add animation
			.delay(function(d, i){
				return i * 20
			})
			.duration(500);

		updateChart(bars, csvData.length, colorScale);
	};
	
	//function to position, size, and color bars in chart
	function updateChart(bars, n, colorScale){
		//position bars
		
		bars.attr("x", function(d, i){
				return i * (chartInnerWidth / n) + leftPadding;
			})
			//size/resize bars
			.attr("height", function(d, i){
				return 463 - yScale(parseFloat(d[expressed]));
			})
			.attr("y", function(d, i){
				return yScale(parseFloat(d[expressed])) + topBottomPadding;
			})
			//color/recolor bars
			.style("fill", function(d){
				return choropleth(d, colorScale);
			});
		//at the bottom of updateChart()...add text to chart title
		var chartTitle = d3.select(".chartTitle")
			.text(expressed + " in Each County");
	};
	
	//function to create color scale generator
	function makeColorScale(data){
		var colorClasses = [
			"#ffffcc",
			"#c2e699",
			"#78c679",
			"#31a354",
			"#006837"
		];

		//create color scale generator
		var colorScale = d3.scaleQuantile()
			.range(colorClasses);

		//build array of all values of the expressed attribute
		var domainArray = [];
		for (var i=0; i<data.length; i++){
			var val = parseFloat(data[i][expressed]);
			domainArray.push(val);
		};
		
		//cluster data using ckmeans clustering algorithm to create natural breaks
		var clusters = ss.ckmeans(domainArray, 5);
		//reset domain array to cluster minimums
		domainArray = clusters.map(function(d){
			return d3.min(d);
		});
		//remove first value from domain array to create class breakpoints
		domainArray.shift();

		//assign array of last 4 cluster minimums as domain
		colorScale.domain(domainArray);
		
		return colorScale;
	};

	//function to test for data value and return color
	function choropleth(props, colorScale){
		//make sure attribute value is a number
		var val = parseFloat(props[expressed]);
		//if attribute value exists and is positive, assign a color; otherwise assign gray
		if (typeof val == 'number' && !isNaN(val) && val>0){
			return colorScale(val);
		} else {
			return "#808080";
		};
	};	
	//function to create the enumeration units based on the county areas
	function setEnumerationUnits(newMexico, map, path, colorScale){
		//add New Mexico to map
		var newMexico = map.selectAll(".counties")
			.data(newMexico)
			.enter()
			.append("path")
			.attr("class", function(d){
				return "counties " + d.properties.CountyFP;
			})
			.attr("d", path)
			.style("fill", function(d){
				return choropleth(d.properties, colorScale);
        })
		    .on("mouseover", function(d){
				highlight(d.properties);
        })
			.on("mouseout",function(d){
				dehighlight(d.properties);
		})
			.on("mousemove", moveLabel);
			
			var desc = newMexico.append("desc")
				.text('{"stroke": "#000", "stroke-width": "0.5px"}');
	};

	//function to create coordinated bar chart
	function setChart(csvData, colorScale){

		//create a second svg element to hold the bar chart
		var chart = d3.select("body")
			.append("svg")
			.attr("width", chartWidth)
			.attr("height", chartHeight)
			.attr("class", "chart");
			
		//create a rectangle for chart background fill
		var chartBackground = chart.append("rect")
			.attr("class", "chartBackground")
			.attr("width", chartInnerWidth)
			.attr("height", chartInnerHeight)
			.attr("transform", translate);
			
		var charTitle = chart.append("text")
			.attr("x", 50)
			.attr("y", 30)
			.attr("class", "chartTitle")
			.text(expressed + " in Each County");
							
		 
		 //set bars for each county
		var bars = chart.selectAll(".bar")
			.data(csvData)
			.enter()
			.append("rect")
			.sort(function(a, b){
				return b[expressed]-a[expressed]
			})
			.attr("class", function(d){
				return "bar " + d.adm1_code;
			})
			.attr("width", (chartInnerWidth-20) / csvData.length - 1)
			.on("mouseover", function(d){
				highlight(d)
			})
			//.on("mouseout", dehighlight(d.properties))
			.on("mousemove", moveLabel);
		 var desc = bars.append("desc")
			.text('{"stroke": "none", "stroke-width": "0px"}');
			
			
		//create vertical axis generator
		var yAxis = d3.axisLeft()
			.scale(yScale);

		//place axis
		var axis = chart.append("g")
			.attr("class", "axis")
			.attr("transform", translate)
			.call(yAxis);

		//create frame for chart border
		var chartFrame = chart.append("rect")
			.attr("class", "chartFrame")
			.attr("width", chartInnerWidth)
			.attr("height", chartInnerHeight)
			.attr("transform", translate);
			//set bar positions, heights, and colors
		
		
		updateChart(bars, csvData.length, colorScale);
	};
	
	//function to highlight enumeration units and bars
	function highlight(props){
		//change stroke
		var selected = d3.selectAll("." + props.COUNTYFP)
			.style("stroke", "blue")
			.style("stroke-width", "2");
	};
	
		//function to reset the element style on mouseout
	function dehighlight(props){
		var selected = d3.selectAll("." + props.COUNTYFP)
			.style("stroke", function(){
				return getStyle(this, "stroke")
			})
			.style("stroke-width", function(){
				return getStyle(this, "stroke-width")
			});

		function getStyle(element, styleName){
			var styleText = d3.select(element)
				.select("desc")
				.text();

			var styleObject = JSON.parse(styleText);

			return styleObject[styleName];
		};
		d3.select(".infolabel")
			.remove();
	};
	
		//function to create dynamic label
	function setLabel(props){
		//label content
		var labelAttribute = "<h1>" + props[expressed] +
			"</h1><b>" + expressed + "</b>";
	console.log(props[expressed])
		//create info label div
		var infolabel = d3.select("body")
			.append("div")
			.attr("class", "infolabel")
			.attr("id", props.COUNTYFP + "_label")
			.html(labelAttribute);

		var regionName = infolabel.append("div")
			.attr("class", "labelname")
			.html(props.name);
	};
	
	//function to move info label with mouse
	function moveLabel(){
		//get width of label
		var labelWidth = d3.select(".infolabel")
			.node()
			.getBoundingClientRect()
			.width;
		//use coordinates of mousemove event to set label coordinates
		var x1 = d3.event.clientX + 10,
			y1 = d3.event.clientY - 75,
			x2 = d3.event.clientX - labelWidth - 10,
			y2 = d3.event.clientY + 25;
			
		//horizontal label coordinate, testing for overflow
		var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
		//vertical label coordinate, testing for overflow
		var y = d3.event.clientY < 75 ? y2 : y1; 

		d3.select(".infolabel")
			.style("left", x + "px")
			.style("top", y + "px");
	};
	
})();