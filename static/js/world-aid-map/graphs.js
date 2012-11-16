// adapt containerwidth to screen size
var containerwidth = function(selector) {
  return parseInt(d3.select(selector).style('width'))
};

var mapselect = '#map',
  width = containerwidth(mapselect),
  height = width * .6,
  legendh = 30,
  selected,
  centered,
  relation, // Population or GDP
  proj = d3.geo.equirectangular().scale(1).translate([0, 0]),
  arc = d3.geo.greatArc().precision(1),
  centroid = function(d) {return path.centroid(d.geometry)},
  format = d3.format(',r'),
  formatpercentage = d3.format(".1%"),
  color = d3.scale.category20(),
  projection = d3.geo.mercator().scale(width).translate([0, 0]),
  path = d3.geo.path().projection(projection);

//FIXME implement country select
var click = function(d) {
  console.log(d);
}

var tf = function() {
  return 'translate(' + width / 2 + ',' + height / 1.8 + ')'
};

var scalelink = function(d) {
  var usd = d.usd;
  if (relation) usd = usd / d[relation];
  return Math.sqrt(usd) / 10000; // FIXME use max to scale
};

var rescale = function() {
  svg.attr('transform', 'translate(' + d3.event.translate + ')'
    + ' scale(' + d3.event.scale + ')')
}

/************** SVG stuff **************/
var svg = d3.select(mapselect).append('svg')
  .attr('width', width)
  .attr('height', height)
  .call(d3.behavior.zoom().on('zoom', function() {rescale()}))
    .append('svg:g');

svg.append('rect')
  .attr('class', 'background')
  .attr('width', width)
  .attr('height', height);

var gcountries = svg.append('g')
  .attr('transform', tf)
  .append('g')
    .attr('id', 'countries');

var garcs = svg.append('g')
  .attr('transform', tf)
  .attr('id', 'arcs');

var drawmap = function(data, colorize, showlinks) {
  geocountries = data.features;
  gcountries.selectAll('path')
    .data(geocountries)
    .enter().append('path')
      .attr('d', path)
      .attr('class', colorize ? colorize : null)
      .on('click', click)
      .on('mouseover', function(d) {
        var t = d3.select(this);
        t.style('origfill', document.defaultView.getComputedStyle(this,null)['fill']);
        t.style('fill', '#d0ffd0');
        showlinks(d.id)
      })
      .on('mouseout', function(d) {
        var t = d3.select(this);
        t.style('fill', t.style('origfill'));
        garcs.selectAll('path.link').remove()
      });
};

var drawlinks = function(links) {
  garcs.selectAll('path')
    .data(links)
    .enter().append('path') 
      .attr('class', 'link')
      .style('stroke-width', function(d) {return scalelink(d)})
      .attr('d', function(d) {
        var p = {source:countryinfo[d.source].coords, target:countryinfo[d.target].coords};
        return path(arc(p))
      });
}

var drawlegend = function() {
  var linew = 25,
    lineoff = 85,
    yoff = -4;

  // add a rect to cover lines at the bottom of the map to not disturb legend
  var grect = svg.append('rect')
    .attr('class', 'bglegend')
    .attr('y', height - legendh - 15)
    .attr('width', width)
    .attr('height', legendh + 15)

  var glegend = svg.append('g')
    .attr('transform', 'translate(0,' + (height - legendh) +')')
    .attr('id', 'legend');

  glegend.append('svg:text')
    .text('Most received')

  glegend.append('svg:text')
    .text('Most donated')
    .attr('x', linew * 10 + lineoff + 10)

  // FIXME make this more flexible
  glegend.selectAll('line.country')
    .data([0,1,2,3,4,6,7,8,9,10]).enter()
    .append('svg:line')
      .attr('class', function(d){return 'q' + d  + '-11'})
      .attr('x1', function(d, i) {return lineoff + linew * i})
      .attr('y1', yoff)
      .attr('x2', function(d, i) {return lineoff + linew + linew * i})
      .attr('y2', yoff)
      .attr('stroke-width', 4);

  var ltext = glegend.append('svg:text')
    .attr('class', 'footer')
    .attr('dy', 16);
  ltext.append('svg:tspan')
    .text('Move the mouse over a country to show aid flow, zoom with the mousewheel, drag with the mouse button pressed.')
    .attr('x', 0)
}

// render bar chart
var bar = function(selector, data) {
  var maxval = d3.max(data, function(d) { return d.val });
  var loff = 110,
    barw = containerwidth(selector) - loff,
    y = 17,
    barh = y * data.length,
    xoff = 10,
    yoff = 16,
    wscale = d3.scale.linear().domain([0, maxval]).range(['0px', barw + 'px']),
    hscale = d3.scale.ordinal().domain(data).rangeBands([0, barh]);

  var bar = d3.select(selector);
  bar.selectAll('svg').remove();
  var svg = bar.append('svg')
    .attr('class', 'bar')
    .attr('width', barw + loff)
    .attr('height', barh + yoff);

  // add lablels
  var labels = svg.selectAll('text')
    .data(data).enter()
  // add left label
  labels.append('text')
    .attr('x', 0)
    .attr('y', function(d, i) {return i * y - 4 + yoff})
    .attr('class', 'info')
    .text(function(d) {return d.label})
    .append('title')
      .text(function(d) {return d.title});
  // add right label
  labels.append('text')
    .attr('x', barw + 9 * xoff)
    .attr('y', function(d, i) {return i * y - 4 + yoff})
    .attr('text-anchor', 'end')
    .text(function(d) {return d.formatval});

  // add actual bars
  svg.selectAll('rect.fillblue')
    .data(data)
    .enter().append('rect')
      .attr('class', 'fillblue')
      .attr('x', 3 * xoff)
      .attr('y', function(d, i) {return i * y})
      .attr('width', function(d) {return isNaN(d.val) ? 0 : wscale(d.val)})
      .attr('height', y - 1);
};

/*
 * render scatterplot
 * data struct [{x:1,y:3,label:'label',title:'title'}]
 */
var scatterplot = function(selector, data) {
  var plotw = containerwidth(selector) - 10,
    ploth = plotw / 2,
    r = 12,
    padding = 25,
    xmax = d3.max(data, function(d) { return d.x }),
    ymax = d3.max(data, function(d) { return d.y }),
    xscale = d3.scale.linear().nice()
      .domain([0, xmax]).range([padding, plotw - 2 * padding]),
    // map ymax to 0 so small values are below large ones
    yscale = d3.scale.linear().nice()
      .domain([0, ymax]).range([ploth - padding, padding]),
    rscale = d3.scale.linear().nice()
      .domain([0, xmax]).range([r, r]),
    xaxis = d3.svg.axis().scale(xscale).ticks(5).tickFormat(formatdollar),
    yaxis = d3.svg.axis().scale(yscale).orient('left').ticks(5);

  var title = function(d) {
    return d.title + ': ' + formatdollar(d.x) + ', ' + format(d.y)
  }

  var plot = d3.select(selector);
  plot.selectAll('svg').remove();
  var svg = plot.append('svg')
    .attr('class', 'scatterplot')
    .attr('width', plotw)
    .attr('height', ploth);

  svg.selectAll('circle.fillblue')
    .data(data).enter()
    .append('circle')
      .attr('class', 'fillblue')
      .attr('cx', function(d) {return xscale(d.x)})
      .attr('cy', function(d) {return yscale(d.y)})
      .attr('r',  function(d) {return rscale(d.x)})
      .append('title')
        .text(title);

  svg.selectAll('text')
    .data(data).enter()
    .append('text')
      .attr('class', 'scatterplot')
      .attr('text-anchor', 'middle')
      .attr('x', function(d) {return xscale(d.x)})
      .attr('y', function(d) {return yscale(d.y) + 3})
      .text(function(d) {return d.label})
      .append('title')
        .text(title);

  svg.append('g')
    .attr('transform', 'translate(0, ' + (ploth - padding) + ')')
    .attr('class', 'axis')
    .call(xaxis);

  svg.append('g')
    .attr('transform', 'translate(' + padding + ', 0)')
    .attr('class', 'axis')
    .call(yaxis);
};
