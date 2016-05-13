var form;
var formelts;
var experiment = {};
var running = false;
var paused = false;

function init() {
    /*
      We get all our info from a single form in the webpage
    */
    form = document.getElementById("instructions");
    /*
      The form should never actually be submitted
     */
    form.addEventListener("submit",function(e) {e.preventDefault(); return false;});
    /*
      If it is changed during a run, that should halt the current
      experiment.
     */
    form.addEventListener("change",stopExperiment);
    /*
      But the "run experiment" button is used.
     */
    var button = document.getElementById("run");
    button.addEventListener("click",runExperiment);
    /*
      We also want to show or hide the bias input.
     */
    var biased = document.getElementById("biased");
    biased.addEventListener("change",setBias);
    setBias();
}

window.addEventListener("load",init);

function getSettings() {
    /*
      Get all the information from the form into an object.
    */
    // Number of coins
    experiment.ncoins = parseInt(form.elements["num"].value) || 1;
    // Are they biased?
    experiment.biased = form.elements["biased"].value;
    // If so, what's the bias (= P(head) )
    experiment.bias = Math.min(1,Math.max(0,parseFloat(form.elements["bias"].value))) || .5;
    // Are they ordered?
    experiment.order = form.elements["order"].value;
    // What's the halting condition?
    experiment.stop = form.elements["stop"].value || "true";
    // What do we record for each experiment?
    experiment.record = form.elements["record"].value;
    // What's the condition to repeat the experiment?
    experiment.loop = form.elements["loop"].value || "true";
    // What do we record for the entire run?
    experiment.total = form.elements["total"].value;
    // How many flips do we do per update cycle?
    experiment.fps = parseInt(form.elements["fps"].value) || 10;
}

function setBias(e) {
    /*
      If we're using a biased coin we need to be able to set the bias,
      but if not then we hide this option.
     */
    var v = (e && e.target.value) || 0;
    var bsel = document.getElementById("biaschoice");
    if (v == 0) {
	bsel.style.display = "none";
    } else {
	bsel.style.display = "inline";
    }
}

function runExperiment(e) {
    /*
      This is our main function where we initialise everything and
      then start the experiment.
    */
    e.preventDefault();
    if (running) {
	/*
	  Experiment is already running
	*/
	if (paused) {
	    paused = false;
	    e.target.value = "Pause experiment";
	} else {
	    paused = true;
	    e.target.value = "Resume experiment";
	}
	return false;
    }
    // Get the settings
    getSettings();
    /*
      n = number of coins
      s = are they ordered?
      p = bias
    */
    var n,s,p;
    /*
      In amongst the conditions and recorded information are various
      "counts".  These keep track of how many times certain events
      occur within an experiment.  At present, the events are just
      patterns of heads and tails.  More advanced patterns would be
      nice to implement.
      The counts are reset on each experiment.
     */
    var counts = {};
    /*
      The totals are similar, except that they persist across the
      experiments.
     */
    var totals = [];
    /*
      When we record information, we have to know where to display it.
     */
    var recordelts = [];
    var totalelts = [];
    /*
      "flips per second", only it's not "per second" but "per frame".
     */
    var fps;

    // Set n,s,p,fps from form data.
    n = experiment.ncoins;
    s = Boolean(experiment.order == 1);
    if (experiment.biased == 0) {
	p = 0.5;
    } else {
	p = experiment.bias;
    }
    fps = experiment.fps;

    /*
      stop and loop are the conditions for continuing to flip.  The
      "stop" condition controls when an individual experiment stops.
      The "loop" condition controls when the whole series of
      experiments stops.
     */
    var stop = makeExpression(experiment.stop,counts,totals);
    var loop = makeExpression(experiment.loop,counts,totals);
    /*
      record and total are arrays of information to be recorded in and between experiments.
    */
    var record = makeRecord(experiment.record,counts,totals,recordelts,"recordtable");
    var total = makeRecord(experiment.total,counts,totals,totalelts,"totalslist");
    /*
      This initialises the count and total registers.
     */
    counts = makeCounters(counts);
    totals = makeTotals(totals);

    /*
      the output element is where the series of heads and tails gets recorded.
     */
    var output = document.getElementById("coins");
    output.innerHTML = "";
    var list = document.createElement("ol");
    output.appendChild(list);
    /*
      If we have more than one coin we use a separator to distinguish
      between sets of flips.  You can't see it, but actually the
      separator for when there's only one coin is a zero-width space.
      This makes line breaking possible.
     */
    var sep;
    if (n > 1) {
	sep = ", ";
    } else {
	sep = "​";
    }
    /*
      The item element is where the current experiment will be recorded.
     */
    var item = document.createElement("li");
    list.appendChild(item);
    
    e.target.value = "Pause experiment";
    running = true;
    paused = false;
    
    /*
      Now that we're all set up, let's roll those coins.
     */
    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,0,fps) });
}

function stopExperiment() {
    var button = document.getElementById("run");
    button.value = "Run experiment";
    running = false;
}

function doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,tf,fps) {
    /*
      This is the function that takes the coin flips and records the
      resultant data and decides what to do next.
    */
    if (!running) {
	var button = document.getElementById("run");
	button.value = "Run experiment";
	return;
    }
    if (paused) {
	window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,tf,fps) });
	return;
    }
    // Increment our flips-per-frame counter
    tf++;
    var coin,cell;
    // Flip the coin(s)!
    coin = flip(n,s,p);
    // Update the count registers
    for (var l=0; l < counts.length; l++) {
	counts[l].increment(coin);
    }
    // Add the result of the flip to the list on display
    item.innerHTML += coin + sep;
    // Update the record entries
    for (var l=0; l < record.length; l++) {
	recordelts[l].innerHTML = record[l](counts,totals);
    }
    // Check the stop condition.
    if (stop(counts,totals)) {
	// That's the end of an experiment, so we update the totals
	for (var l=0; l < totals.length; l++) {
	    totals[l].increment(counts);
	}
	// and display the results
	for (var l=0; l < total.length; l++) {
	    totalelts[l].innerHTML = total[l](counts,totals);
	}
	// reset the count registers
	for (var l=0; l < counts.length; l++) {
	    counts[l].reset();
	}
	// add a new column to the record table
	for (var l=0; l < recordelts.length; l++) {
	    cell = document.createElement("td");
	    recordelts[l].parentNode.insertBefore(cell, recordelts[l].nextSibling);
	    recordelts[l] = cell;
	}
	// Are we finished overall?
	if (!loop(counts,totals)) {
	    // Nope, so create a new li for the next experiment and
	    // start all over again
	    item = document.createElement("li");
	    list.appendChild(item);
	    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,0,fps) });
	} else {
	    // Time to stop
	    running = false;
	    var button = document.getElementById("run");
	    button.value = "Run experiment";
	}
    } else {
	// Still going, so check if we're in the same fram or if it's
	// time to break out
	if (tf < fps) {
	    // Same frame, so call ourselves once more
	    doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,tf,fps);
	} else {
	    // New frame, so call ourselves but via the animation frame
	    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts,0,fps) });
	}
    }	
}

function flip(n,o,p) {
    /*
      This is the routine that actually fips some coins.
     */
    var flips = [];
    for (var i = 0; i < n; i++) {
	if (Math.random() > p) {
	    flips.push("T");
	} else {
	    flips.push("H");
	}
    }
    if (o) {
	flips.sort();
    }
    return flips.join("");
}

function check(c,k) {
    /*
      This is for the count and total registers: it simply returns
      their values.  This is necessary because we create functions on
      the fly and have to get around the weird scoping rules.
     */
    return c[k].value;
}

function makeCounters(c) {
    /*
      This assigns Counter objects to each count that is called for.
     */
    var ctr = [];
    for (k in c) {
	ctr[c[k]] = new Counter(k);
    }
    return ctr;
}

function makeTotals(t) {
    /*
      This assigns Total objects to each total that is called for.
     */
    var tl = [];
    for (k in t) {
	tl[k] = new Total(t[k]);
    }
    return tl;
}

function makeExpression(str,c,t) {
    /*
      This takes an expression as supplied by the user and attempts to
      make sense of it.  Probably could do with better error catching.
     */
    var patterns, pattern;
    var nc = Object.keys(c).length;
    /*
      Replace natural language by javascript
     */
    str = str.replace("and","&&");
    str = str.replace("or","||");
    str = str.replace("not","!");
    str = str.replace("=","==");
    str = str.replace("====","==");

    /*
      Look through for any occurences of "count(...)".
     */
    patterns = str.match(/count\([^)]*\)/gi);
    if (patterns) {
	for (var i = 0; i < patterns.length; i++) {
	    /*
	      For each match, we take the bit between the parenthesis
	     */
	    pattern = patterns[i].substr(6,patterns[i].length-7).toLocaleLowerCase();
	    /*
	      If we haven't seen it before, register it
	     */
	    if (typeof c[pattern] === "undefined") {
		c[pattern] = nc++ ;
	    }
	}
	/*
	  Replace the "count(...)" in the expression by a function
	  that returns the value of the corresponding register.
	 */
	str = str.replace(/count\(([^)]*)\)/gi,function(m,p) {return " check(c," + c[p.toLocaleLowerCase()] + ") ";});
    }

    /*
      Now do something similar for totals
     */
    var totalstr;
    if (str.indexOf("total(") > -1) {
	var i = 0;
	var j = 0;
	var p,total,fn;
	totalstr = "";
	while (str.indexOf("total(",i) > -1 && i < str.length) {
	    i = str.indexOf("total(");
	    totalstr += str.substr(j,i);
	    p = 1;
	    j = i+6;
	    /*
	      What's inside a "total(...)" can be more complicated, so
	      we need to carefully find the closing bracket.
	     */
	    while (p > 0 && i < str.length) {
		if (str.substr(j,1) == "(") {
		    p++;
		} else if (str.substr(j,1) == ")") {
		    p--;
		}
		j++;
	    }
	    /*
	      Found it, so make a new expression from the innards.
	     */
	    total = str.substring(i+6,j-1);
	    fn = makeExpression(total,c,t);
	    /*
	      Save the corresponding function.
	     */
	    t.push(fn);
	    i = j;
	    /*
	      Replace the "total(...)" by a function to return the
	      value of the corresponding Total register.
	     */
	    totalstr += " check(t," + (t.length - 1) + ") ";
	}
	totalstr += str.substr(j);
    } else {
	totalstr = str;
    }
    // Turn the modified string into a function
    str = Function("c", "t", "return " + totalstr);
    return str;
}

function makeRecord(str,c,t,rc,id) {
    /*
      This sets up elements on the page that will receive the counts
      and totals as they are worked out.  Counts will be in a table,
      records in a list.  We can cope with both.
     */
    if (str == "") {
	return [];
    }
    var patterns,pattern,nc;
    nc = Object.keys(c).length;
    var record = str.split(/\s*[,;]\s*/);
    var recording = document.getElementById(id);
    recording.innerHTML = '';
    var entrytag;
    var labeltag;
    var itemtag;
    if (recording.tagName == "TABLE") {
	entrytag = 'tr';
	labeltag = 'td';
	itemtag = 'td';
    } else if (recording.tagName == "OL") {
	entrytag = 'li';
	labeltag = 'span';
	itemtag = 'span';
    }
    var entry, label, item;
    for (var k=0; k<record.length; k++) {
	entry = document.createElement(entrytag);
	recording.appendChild(entry);
	entry.className += ' record';
	label = document.createElement(labeltag);
	entry.appendChild(label);
	label.className += ' recordLabel';
	labeltxt = document.createTextNode(record[k]);
	label.appendChild(labeltxt);
	recordelt = document.createElement(itemtag);
	entry.appendChild(recordelt);
	rc.push(recordelt);
	record[k] = makeExpression(record[k],c,t);
    }
    return record;
}

Counter = function(s,k) {
    /*
      This is an object for counting occurences of patterns within a
      single experiment.
     */
    this.value = 0;
    this.length = s.length;
    this.state = "";
    if (k > 1) {
	this.sep = ",";
	this.length++;
    } else {
	this.sep = "";
    }
    this.pattern = s.toUpperCase() + this.sep;

    this.increment = function(f) {
	this.state += f.toUpperCase() + this.sep;
	while (this.state.length > this.length) {
	    this.state = this.state.substr(1);
	}
	if (this.state == this.pattern) {
	    this.value++;
	}
    }

    this.reset = function() {
	this.state = "";
	this.value = 0;
    }
    
    return this;
}

Total = function(f) {
    /*
      This is an object for keeping track of information between experiments.
     */
    this.fn = f;
    this.value = 0;
    
    this.increment = function(c) {
	this.value += this.fn(c);
    }
    
    this.reset = function() {
	this.value = 0;
    }
}
