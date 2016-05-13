var form;
var formelts;
var experiment = {};

function init() {
    form = document.getElementById("instructions");
    form.addEventListener("change",function(e) {e.preventDefault(); return false;});
    var button = document.getElementById("run");
    button.addEventListener("click",runExperiment);
    var biased = document.getElementById("biased");
    biased.addEventListener("change",setBias);
    setBias();
}

window.addEventListener("load",init);

function getSettings() {
    experiment.ncoins = parseInt(form.elements["num"].value) || 1;
    experiment.biased = form.elements["biased"].value;
    experiment.bias = Math.min(1,Math.max(0,parseFloat(form.elements["bias"].value))) || .5;
    experiment.order = form.elements["order"].value;
    experiment.stop = form.elements["stop"].value || "true";
    experiment.record = form.elements["record"].value;
    experiment.loop = form.elements["loop"].value || "true";
    experiment.total = form.elements["total"].value;
}

function setBias(e) {
    var v = (e && e.target.value) || 0;
    var bsel = document.getElementById("biaschoice");
    if (v == 0) {
	bsel.style.display = "none";
    } else {
	bsel.style.display = "inline";
    }
}

function runExperiment() {
    getSettings();
    var n,s,p;
    var counts = {};
	var totals = [];
    var pattern;
    var recordelts = [];
    var totalelts = [];

    n = experiment.ncoins;
    s = Boolean(experiment.order == 1);
    if (experiment.biased == 0) {
	p = 0.5;
    } else {
	p = experiment.bias;
    }
    var stop = makeExpression(experiment.stop,counts,totals);
    var loop = makeExpression(experiment.loop,counts,totals);
    var record = makeRecord(experiment.record,counts,totals,recordelts,"recordtable");
    var total = makeRecord(experiment.total,counts,totals,totalelts,"totalslist");
    counts = makeCounters(counts);
	totals = makeTotals(totals);
    
    var output = document.getElementById("coins");
    output.innerHTML = "";
	var list = document.createElement("ol");
	output.appendChild(list);
    var sep;
    if (n > 1) {
	sep = ", ";
    } else {
	sep = "​";
    }
	var item = document.createElement("li");
	list.appendChild(item);
	window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts) });
}

function doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts) {
    var coin,cell;
	coin = flip(n,s,p);
	for (var l=0; l < counts.length; l++) {
		counts[l].increment(coin);
	}
	item.innerHTML += coin + sep;
	for (var l=0; l < record.length; l++) {
		recordelts[l].innerHTML = record[l](counts,totals);
	}
	
	if (stop(counts,totals)) {
		for (var l=0; l < totals.length; l++) {
			totals[l].increment(counts);
		}
		for (var l=0; l < total.length; l++) {
			totalelts[l].innerHTML = total[l](counts,totals);
		}
		for (var l=0; l < counts.length; l++) {
			counts[l].reset();
		}
		for (var l=0; l < recordelts.length; l++) {
			cell = document.createElement("td");
			recordelts[l].parentNode.insertBefore(cell, recordelts[l].nextSibling);
			recordelts[l] = cell;
		}
		if (!loop(counts,totals)) {
			item = document.createElement("li");
			list.appendChild(item);			
			window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts) });
		}
	} else {
		window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,total,totals,totalelts,n,s,p,sep,record,recordelts) });
	}	
}

function flip(n,o,p) {
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
    return c[k].value;
}

function makeCounters(c) {
    var ctr = [];
    for (k in c) {
	ctr[c[k]] = new Counter(k);
    }
    return ctr;
}

function makeTotals(t) {
	var tl = [];
	for (k in t) {
		tl[k] = new Total(t[k]);
	}
	return tl;
}

function makeExpression(str,c,t) {
    var patterns, pattern;
    var nc = Object.keys(c).length;
    str = str.replace("and","&&");
    str = str.replace("or","||");
    str = str.replace("not","!");
	str = str.replace("=","==");
	str = str.replace("====","==");
    
    patterns = str.match(/count\([^)]*\)/gi);
    if (patterns) {
	for (var i = 0; i < patterns.length; i++) {
	    pattern = patterns[i].substr(6,patterns[i].length-7).toLocaleLowerCase();
	    if (typeof c[pattern] === "undefined") {
		c[pattern] = nc++ ;
	    }
	}
	str = str.replace(/count\(([^)]*)\)/gi,function(m,p) {return " check(c," + c[p.toLocaleLowerCase()] + ") ";});
    }

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
		while (p > 0 && i < str.length) {
			if (str.substr(j,1) == "(") {
				p++;
			} else if (str.substr(j,1) == ")") {
				p--;
			}
			j++;
		}
		total = str.substring(i+6,j-1);
		fn = makeExpression(total,c,t);
		t.push(fn);
		i = j;
		totalstr += " check(t," + (t.length - 1) + ") ";
	}
	totalstr += str.substr(j);
	} else {
		totalstr = str;
	}
	str = Function("c", "t", "return " + totalstr);
    return str;
}

function makeRecord(str,c,t,rc,id) {
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
	this.fn = f;
	this.value = 0;
	
	this.increment = function(c) {
		this.value += this.fn(c);
	}
	
	this.reset = function() {
		this.value = 0;
	}
}