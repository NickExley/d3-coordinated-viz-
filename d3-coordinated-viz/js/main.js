//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
	//map frame dimensions
    var width = 960,
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
    promises.push(d3.json("data/us_states.topojson")); //load background spatial data
    promises.push(d3.json("data/new_mexico.topojson")); //load choropleth spatial data
    Promise.all(promises).then(callback);

    function callback(data){
		csvData = data[0];
		states = data[1];
		newMexico = data[2];
		console.log(newMexico.objects);
		//translate states & new mexico TopoJSON
		var usStates = topojson.feature(states, states.objects.cb_2017_us_state_500k),
		newMexico = topojson.feature(newMexico, newMexico.objects.new_mexico).features;

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
		
		//add US states to map
        var states = map.append("path")
            .datum(usStates)
            .attr("class", "states")
            .attr("d", path);

        //add New Mexico to map
        var nmCounties = map.selectAll(".counties")
            .data(newMexico)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "counties " + d.properties.CountyFP;
            })
            .attr("d", path);
    };
};