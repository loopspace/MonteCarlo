var form;
var formelts;
var experiment = {};
var running = false;
var paused = false;
var packOfCards;
var packOrder;

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
    checkPlurals();
    /*
      The first list chooses what object will be involved in the experiments.
    */
    var type = document.getElementById("expt");
    type.addEventListener("change",setType);
    setType();
    /*
      Make the question mark toggle the help pane
     */
    var hlnk = document.getElementById('helplink');
    var hdv = document.getElementById('help');
    hlnk.addEventListener('click', function(e) {
	e.preventDefault();
	if (hdv.style.display == 'none' || hdv.style.display == '') {
	    hdv.style.display = 'block';
	} else {
	    hdv.style.display = 'none';
	}
	return false;
    });
    /*
      Set the help pane height to the window height,
      Should probably update on resize
     */
    var h = window.innerHeight - 20;
    hdv.style.height = h + 'px';
}

window.addEventListener("load",init);

function getSettings() {
    /*
      Get all the information from the form into an object.
    */
    // Type of experiment
    experiment.type = parseInt(form.elements["expt"].value) || 0;
    // Number of coins/dice/cards
    experiment.ncoins = parseInt(form.elements["num"].value) || 1;
    // Are they biased?
    experiment.biased = form.elements["biased"].value;
    // If so, what's the bias (= P(head) for coin )
    experiment.bias = form.elements["bias"].value;
    // Are they ordered?
    experiment.order = form.elements["order"].value;
    // Sides of die?
    experiment.sides = Math.max(0,parseInt(form.elements["nsides"].value)) || 6;
    // Number of cards in a hand
    experiment.hand = Math.max(0,parseInt(form.elements["hand"].value)) || 5;
    // Number of cards in a deck
    experiment.deck = Math.max(Math.min(parseInt(form.elements["deck"].value),52),0) || 52;
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

function setType(e) {
    var type = form.elements["expt"].value;
    form.reset();
    form.elements["expt"].value = type;
    var dice = [
	document.getElementById("nodice"),
	document.getElementById("yesdice"),
    ];
    var cards = [
	document.getElementById("nocards"),
	document.getElementById("yescards"),
    ];
    var updates = [
	document.getElementById("excoin"),
	document.getElementById("exdie"),
	document.getElementById("excard"),
    ];
    var v = type || 0;
    for (var k = 0; k < 3; k++) {
	updates[k].style.display = 'none';
    }
    updates[v].style.display = 'inline';
    if (v == 1) {
	dice[0].style.display = 'none';
	dice[1].style.display = 'inline';
    } else {
	dice[0].style.display = 'inline';
	dice[1].style.display = 'none';
    }
    if (v == 2) {
	cards[0].style.display = 'none';
	cards[1].style.display = 'inline';
    } else {
	cards[1].style.display = 'none';
	cards[0].style.display = 'inline';
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
      n = number of coins/dice/cards
      dn = number of sides of dice
      s = are they ordered?
      p = biases
    */
    var n,dn,s,p;
    /*
      In amongst the conditions and recorded information are various
      "counts".  These keep track of how many times certain events
      occur within an experiment.  At present, the events are just
      patterns of heads and tails.  More advanced patterns would be
      nice to implement.
      The counts are reset on each experiment.
     */
    var counts = {};
    var rcounts = {};
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

    // Set n,dn,s,p,fps from form data.
    n = experiment.ncoins;
    dn = experiment.sides;
    s = Boolean(experiment.order == 1);
    if (experiment.biased == 0) {
	if (experiment.type == 0) {
	    p = 0.5;
	} else if (experiment.type == 1) {
	    p = [];
	    for (var i = 0; i < dn; i++) {
		p.push(1/dn);
	    }
	}
    } else {
	if (experiment.type == 0) {
	    p = experiment.bias;
	} else if (experiment.type == 1) {
	    p = experiment.bias.split(/,/);
	    var tp = 0;
	    var np = 0;
	    for (var i = 0; i < dn; i++) {
		if (p[i] && p[i] != '') {
		    p[i] = parseFloat(p[i]);
		    tp += p[i];
		    np += 1;
		}
	    }
	    for (var i = 0; i < dn; i++) {
		if (!p[i] || p[i] == '') {
		    p[i] = (1 - tp)/(dn - np);
		}
	    }
	}
    }
    if (experiment.type == 2) {
	p = {};
	p.deck = experiment.deck;
	p.hand = experiment.hand;
	if (n * p.hand > p.deck) {
	    n = Math.floor(p.deck/p.hand);
	    form.elments["num"].value = n;
	}
	setDeck(p.deck);
    }
    fps = experiment.fps;

    var expt;
    var fmt;
    if (experiment.type == 0) {
	expt = function() {
	    return flip(n,s,p);
	}
	fmt = function(s) {return s};
    } else if (experiment.type == 1) {
	expt = function() {
	    return roll(n,s,p);
	}
	fmt = function(s) {return s};
    } else if (experiment.type == 2) {
	expt = function() {
	    return deal(n,s,p);
	}
	fmt = function(s) {
	    s = s.replace(/C/g,'<span class="blacksuit">&#9827;</span>');
	    s = s.replace(/D/g,'<span class="redsuit">&#9830;</span>');
	    s = s.replace(/H/g,'<span class="redsuit">&#9829;</span>');
	    s = s.replace(/S/g,'<span class="blacksuit">&#9824;</span>');
	    return s;
	};
    }
    
    /*
      stop and loop are the conditions for continuing to flip.  The
      "stop" condition controls when an individual experiment stops.
      The "loop" condition controls when the whole series of
      experiments stops.
     */
    var stop = makeExpression(experiment.stop,counts,rcounts,totals);
    var loop = makeExpression(experiment.loop,counts,rcounts,totals);
    /*
      record and total are arrays of information to be recorded in and between experiments.
    */
    var record = makeRecord(experiment.record,counts,rcounts,totals,recordelts,"recordtable");
    var total = makeRecord(experiment.total,counts,rcounts,totals,totalelts,"totalslist");
    /*
      This initialises the count and total registers.
     */
    counts = makeCounters(counts,n);
    rcounts = makeRegexCounters(rcounts,n);
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
    item.className = 'expt';
    list.appendChild(item);
    
    e.target.value = "Pause experiment";
    running = true;
    paused = false;
    
    /*
      Now that we're all set up, let's roll those coins.
     */
    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,0,fps) });
}

function stopExperiment() {
    checkPlurals();
    var button = document.getElementById("run");
    button.value = "Run experiment";
    running = false;
}

function checkPlurals() {
    if (form.elements["num"].value == 1|| form.elements["num"].value == '') {
	document.getElementById("order").style.display = 'none';
	document.getElementById("plcoins").style.display = 'none';
	document.getElementById("pldice").style.display = 'none';
	document.getElementById("plhands").style.display = 'none';
    } else {
	document.getElementById("order").style.display = 'inline';
	document.getElementById("plcoins").style.display = 'inline';
	document.getElementById("pldice").style.display = 'inline';
	document.getElementById("plhands").style.display = 'inline';
    }
    if (form.elements["hand"].value == 1 || form.elements["hand"].value == '') {
	document.getElementById("plcards").style.display = 'none';
    } else {
	document.getElementById("plcards").style.display = 'inline';
    }
    /*
    if (form.elements["deck"].value == 1 || form.elements["deck"].value == '') {
	document.getElementById("pldecks").style.display = 'none';
    } else {
	document.getElementById("pldecks").style.display = 'inline';
    }
    */
    if (form.elements["fps"].value == 1 || form.elements["fps"].value == '') {
	document.getElementById("plexpts").style.display = 'none';
    } else {
	document.getElementById("plexpts").style.display = 'inline';
    }
}

function doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,tf,fps) {
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
	window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,tf,fps) });
	return;
    }
    // Increment our flips-per-frame counter
    tf++;
    var coin,cell;
    // Flip the coin(s)!  Or roll the dice, or deal the cards.
    coin = expt();
    // Update the count registers
    for (var l=0; l < counts.length; l++) {
	counts[l].increment(coin);
    }
    // Update the rcount registers
    for (var l=0; l < rcounts.length; l++) {
	rcounts[l].increment(coin);
    }
    // Add the result of the flip to the list on display
    item.innerHTML += fmt(coin) + sep;
    // Update the record entries
    for (var l=0; l < record.length; l++) {
	recordelts[l].innerHTML = record[l](counts,rcounts,totals);
    }
    // Check the stop condition.
    if (stop(counts,rcounts,totals)) {
	// That's the end of an experiment, so we update the totals
	for (var l=0; l < totals.length; l++) {
	    totals[l].increment(counts,rcounts);
	}
	// and display the results
	for (var l=0; l < total.length; l++) {
	    totalelts[l].innerHTML = total[l](counts,rcounts,totals);
	}
	// reset the count registers
	for (var l=0; l < counts.length; l++) {
	    counts[l].reset();
	}
	// reset the count registers
	for (var l=0; l < rcounts.length; l++) {
	    rcounts[l].reset();
	}
	// add a new column to the record table
	for (var l=0; l < recordelts.length; l++) {
	    cell = document.createElement("td");
	    recordelts[l].parentNode.insertBefore(cell, recordelts[l].nextSibling);
	    recordelts[l] = cell;
	}
	// Are we finished overall?
	if (!loop(counts,rcounts,totals)) {
	    // Nope, so create a new li for the next experiment and
	    // start all over again
	    item = document.createElement("li");
	    item.className = 'expt';
	    list.appendChild(item);
	    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,0,fps) });
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
	    doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,tf,fps);
	} else {
	    // New frame, so call ourselves but via the animation frame
	    window.requestAnimationFrame( function() { doExperiment(list,item,stop,loop,counts,rcounts,total,totals,totalelts,expt,fmt,sep,record,recordelts,0,fps) });
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

function roll(n,o,p) {
    /*
      This is the routine that actually rolls some dice.
    */
    var rolls = [];
    var r;
    var pd = Math.floor(Math.log10(p.length)) + 1;
    for (var i = 0; i < n; i++) {
	r = Math.random();
	for (var j = 0; j < p.length; j++) {
	    if (r < p[j]) {
		rolls.push(pad(j+1,pd));
		break;
	    } else {
		r -= p[j];
	    }
	}
    }
    if (o) {
	rolls.sort();
    }
    return rolls.join("");
}

function deal(n,o,p) {
    /*
      This is the routine that actually deals some cards.
    */
    var pack = shuffle(p.deck);
    var hand = [];
    for (var i = 0; i < n; i++) {
	hand.push(pack.slice(i*p.hand,(i+1)*p.hand));
	// Need a better sorting algorithm here
	hand[i].sort(function(a,b) { return packOrder[a] - packOrder[b] });
	hand[i] = hand[i].join("");
    }
    return hand.join(";");
}

function setDeck(n) {
    var s = ["C","D","H","S"];
    var sc = ["A",2,3,4,5,6,7,8,9,"T","J","Q","K"];
    var p = [];
    var o = {};
    var l = Math.floor(n/4);
    var m = [l,l,l,l];
    for (var i = l*4; i < n; i++) {
	m[i]++;
    }
    l = 0;
    for (var i = 0; i < 4; i++) {
	for (var j = 0; j < m[i]; j++) {
	    p.push(sc[j] + s[i]);
	    o[sc[j] + s[i]] = l;
	    l++;
	}
    }
    packOfCards = p;
    packOrder = o;
}

function shuffle(n) {
    var d = [];
    for (var i = 0; i < n; i++) {
	d[i] = packOfCards[i];
    }
    var r,t;
    for (var i = 0; i < n; i++) {
	r = Math.floor(Math.random() * (n - i)) + i;
	t = d[r];
	d[r] = d[i];
	d[i] = t;
    }
    return d;
}

function check(c,k) {
    /*
      This is for the count and total registers: it simply returns
      their values.  This is necessary because we create functions on
      the fly and have to get around the weird scoping rules.
     */
    return c[k].value;
}

function makeCounters(c,n) {
    /*
      This assigns Counter objects to each count that is called for.
     */
    var ctr = [];
    for (k in c) {
	ctr[c[k]] = new Counter(k,n);
    }
    return ctr;
}

function makeRegexCounters(c,n) {
    /*
      This assigns Counter objects to each count that is called for.
     */
    var ctr = [];
    for (k in c) {
	ctr[c[k]] = new RegexCounter(k,n);
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

function makeExpression(str,c,r,t) {
    /*
      This takes an expression as supplied by the user and attempts to
      make sense of it.  Probably could do with better error catching.
     */
    var patterns, pattern;
    var nc = Object.keys(c).length;
    var nr = Object.keys(r).length;
    /*
      Replace natural language by javascript
     */
    str = str.replace(/and/gi,"&&");
    str = str.replace(/or/gi,"||");
    str = str.replace(/not/gi,"!");
    str = str.replace(/=/g,"==");
    str = str.replace(/====/g,"==");

    var nstr = "";
    var ind = 0;

    /*
      Look through for words
    */
    var wordre = new RegExp('[a-z]+','ig');
    var word;
    var arg;
    var i,p,pind;
    var fn;

    while (word = wordre.exec(str)) {
	if (word.index < ind) {
	    continue;
	}
	/*
	  Add everything up to the word to the output string
	*/
	nstr += str.substring(ind,word.index);
	/*
	  Add a space
	*/
	nstr += " ";
	/*
	  Get the argument to the word
	*/
	arg = "";
	ind = word.index + word[0].length;
	/*
	  Check for the magic word "true"
	*/
	if (word[0] == "true") {
	    nstr += "true ";
	    continue;
	}
	/*
	  For everything else, we look for the argument.

	  Find the opening bracket.
	*/
	while (ind < str.length && str.charAt(ind) != "(") {
	    ind++;
	}
	p = 1;
	pind = ind;
	pind++;
	/*
	  Now find the matching closing bracket
	*/
	while (ind < str.length && p > 0) {
	    ind++;
	    if (str.charAt(ind) == "(") {
		p++;
	    }
	    if (str.charAt(ind) == ")") {
		p--;
	    }
	}
	/*
	  The substring is the argument
	*/
	arg = str.substring(pind,ind);
	ind++;
	/*
	  Add the check function to the string
	*/
	nstr += 'check(';

	/*
	  If we haven't seen the counter before, register it
	*/
	if (word[0] == "count") {
	    if (typeof c[arg] === "undefined") {
		c[arg] = nc++;
	    }
	    nstr += 'c,' + c[arg];
	} else if (word[0] == "rcount") {
	    if (typeof r[arg] === "undefined") {
		r[arg] = nr++;
	    }
	    nstr += 'r,' + r[arg];
	} else if (word[0] == "total") {
	    if (arg.replace(/\s+/g) == '') {
		arg = "1";
	    }
	    fn = makeExpression(arg,c,r,t);
	    /*
	      Save the corresponding function.
	     */
	    t.push(fn);
	    nstr += 't,' + (t.length - 1);
	}
	nstr += ')';
    }
    /*
      Add the rest of the string
     */
    nstr += str.substring(ind);
    // Turn the modified string into a function
    return Function("c", "r", "t", "return " + nstr);
}


/*
This is the original construction function
*/
function stuff() {
	
    /*
      Look through for any occurences of "rcount(...)".
      
      Note: due to the way this works, currently the pattern can't
      contain parentheses.  Put this on the TODO list ...
    */
	
    patterns = str.match(/rcount\([^)]*\)/gi);
    if (patterns) {
	for (var i = 0; i < patterns.length; i++) {
	    /*
	      For each match, we take the bit between the parenthesis
	     */
	    pattern = patterns[i].substr(7,patterns[i].length-8);
	    /*
	      If we haven't seen it before, register it
	     */
	    if (typeof r[pattern] === "undefined") {
		r[pattern] = nr++ ;
	    }
	}
	/*
	  Replace the "rcount(...)" in the expression by a function
	  that returns the value of the corresponding register.
	 */
	str = str.replace(/rcount\(([^)]*)\)/gi,function(m,p) {return " check(r," + r[p] + ") ";});
    }

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
	    /*
	      if this is empty, we assume the user meant to count the
	      number of experiments (similar to what count() does)
	    */
	    if (total.replace(/\s+/g) == '') {
		total = "1";
	    }
	    fn = makeExpression(total,c,r,t);
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
    str = Function("c", "r", "t", "return " + totalstr);
    return str;
}

function makeRecord(str,c,r,t,rc,id) {
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
	record[k] = makeExpression(record[k],c,r,t);
    }
    return record;
}

Counter = function(s,k) {
    /*
      This is an object for counting occurences of patterns within a
      single experiment.
     */
    this.value = 0;
    s = s.replace(/\s+/g,'');
    this.length = s.length;
    this.state = "";
    if (k > 1) {
	this.sep = ",";
    } else {
	this.sep = "";
    }
    this.pattern = s.toUpperCase();

    this.increment = function(f) {
	f += this.sep;
	for (var k = 0; k < f.length; k ++) {
	    this.state += f[k].toUpperCase();
	    if (this.state.length > this.length) {
		this.state = this.state.substr(this.state.length - this.length);
	    }
	    if (this.state == this.pattern) {
		this.value++;
	    }
	}
    }

    this.reset = function() {
	this.state = "";
	this.value = 0;
    }
    
    return this;
}

RegexCounter = function(s,k) {
    /*
      This is an object for counting occurences of regex patterns
      within a single experiment.
     */
    this.value = 0;
    this.state = "";
    if (k > 1) {
	this.sep = ",";
    } else {
	this.sep = "";
    }
    if (s.substr(-1) != '$') {
	s += '$';
    }
    this.pattern = new RegExp(s,'i');
    this.matches = [];

    this.increment = function(f) {
	f += this.sep;
	var s;
	for (var k = 0; k < f.length; k++) {
	    this.state += f[k].toUpperCase();
	    s = this.state.search(this.pattern);
	    if (s != -1 && !this.matches[s]) {
		this.value++;
		this.matches[s] = true;
	    }
	}
    }

    this.reset = function() {
	this.state = "";
	this.matches = [];
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

function pad(n,l) {
    var ln = Math.floor(Math.log10(Math.abs(n)))+1; // length of n
    var z;
    if (ln < l) {
        z = new Array(l - ln + 1).join('0');
    } else {
        z = '';
    }
    z += n.toString();
    return z;
}
