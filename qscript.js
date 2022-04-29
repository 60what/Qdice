 
'use strict';

let $ = (selectors) => document.querySelector(selectors);
let $id = id => document.getElementById(id);  // ------------------- unused? remove?
let $all = (selectors) => document.querySelectorAll(selectors);
  
function hasButOnlyIf(element, className, conditional) {
	if (conditional) {
		element.classList.add(className);
	} else {
		element.classList.remove(className);
	}
	return conditional;	
}

function spawn(){
	// ordered arguments: parent element, tag name (optional: class, text, onclick)
	let e = document.createElement(arguments[1]);
	if (arguments[2]) e.className = arguments[2];
	if (arguments[3]) e.innerText = arguments[3];
	if (arguments[4]) e.setAttribute('onclick', arguments[4]);
	arguments[0].appendChild(e);
	return e;	
}

function simpleToast(t, msg) {
	let e = $('.toast');
	e.style.visibility = 'visible'; // doc edit
	e.innerText = msg;
	setTimeout(() => { e.style.visibility = 'hidden'; }, t); // doc edit
}



var pwa = document.location.href.toString().includes('user_mode=app');

var landscape = -1;							// landscape unknown yet
var seed = -1;								// dice not shaken yet
var dice_locked = new Array(5).fill(false);	// for dice locked by card selections
var shake_count = 0;
var penalties = 0;
var game_end = false;
var scorecard = false;
var use_numerals = false;

var undo = 1;
var consume = 0;
var undone = -1;

var actions = [[0]];

// alternate mixed colors, this is only a ref, CSS handles the color
const mix_c = [
	[2,2,2,4,4,4,3,3,3,1,1],
	[1,1,3,3,3,3,4,4,2,2,2],
	[4,4,4,2,2,2,1,1,1,3,3],
	[3,3,1,1,1,1,2,2,4,4,4] ];

// alternate mixed numbers, this is used to fill in the scorecard
const mix_n = [
	[ 10,  6,  2,  8,  3,  4, 12,  5,  9,  7, 11],
	[  9, 12,  4,  6,  7,  2,  5,  8, 11,  3, 10],
	[  8,  2, 10, 12,  6,  9,  7,  4,  5, 11,  3],
	[  5,  7, 11,  9, 12,  3,  8, 10,  2,  6,  4] ];



/*	Simple vector images can be included inline and reused as needed.
	SVG files are text readable and included here as template literals.
	These can be easily parsed into data files for image backgrounds.
	On page load, these are assigned to an element with a matching class.
	(Color can also be changed after: https://codepen.io/sosuke/pen/Pjoqqp)
	SVGs can be inserted as inline markup tags and styled with CSS as well.
	Both uses are included as examples. */

const svg = new Map();
svg.set('svg_scorecard',
  `<svg viewBox='0 0 24 24' stroke-linejoin='round' stroke-linecap='round'>
    <path d='M5 13h5m-5 3h13M15 4.5h-12.5v15h18v-6M13 11v2h2l7-7-2-2zM18 6l2 2' fill='none'/>
  </svg>`);
svg.set('svg_reset',
  `<svg viewBox='0 0 24 24' stroke-linecap='round'>
    <path id='a' d='M5.6 3.3v2.5h2.5M5.6 5.6A9 9 0 0120.9 13.6' fill='none'/>
    <g transform='rotate(180 12 12)'><use href='#a'/></g>
  </svg>`);
  
function svg_bg(e) {
	let c = Array.from(e.classList).find(x => x.includes('svg_'));
	// make SVG compliant, add color, URI encode < > #, then remove line breaks
	let bg = svg.get(c).replace(`<svg`, `<svg xmlns='http://www.w3.org/2000/svg'`);
	bg = bg.replace(`<svg`, `<svg stroke='${getComputedStyle(e).color}'`);
	bg = bg.replace(/[<>#]/g, encodeURIComponent);
	bg = bg.replace(/[\r\n]/g, '');

	e.style.backgroundImage = `url("data:image/svg+xml,${bg}")`;
}

function svg_inline(e) {
	let c = Array.from(e.classList).find(x => x.includes('svg_'));
	e.innerHTML = svg.get(c); // doc edit
}



window.onload = populate();

function populate() {

    if (pwa) handleBackEvents(); //------------------------------------------------------------------------------------

    let s = $all('.scoring .stripe');
    for (let i = 0; i < 4; i++) {					// there are 4 stripes on the card for scoring
      for (let j = 0; j < 12; j++) {				// add 12 clickable tiles in each stripe
		  let gen1 = spawn(s[i], 'div', 'mixxbg');	// div(mixxbg) > div(tile) > span > p + p
		  let classes = 'tile' + (j == 10 ? ' tile_off' : j == 11 ? ' lock' : '');
		  let click = (j < 11 ? `toggle_tile(${i}, ${j});` : `toggle_lock(${i}, 0);`);
		  let gen3 = spawn(spawn(gen1, 'div', classes, '', click), 'span');
		  spawn(gen3, 'p', '', (j > 10 ? 'X' : i < 2 ? j + 2 : 12 - j));
		  spawn(gen3, 'p', '', (j > 10 ? 'X' : mix_n[i][j]));
      }
    }

    for (let i = 0; i < 4; i++) {					// add 4 clickable tiles (+span) in the penalty area
		spawn(spawn($('.penalty'), 'div', 'tile', '', 'toggle_penalty(this);'), 'span');
    }

    for (let i = 0; i < 6; i++) {					// add 6 tiles in the points area
		let pointsBox = spawn($('.points'), 'div', 'tile');	
		spawn(pointsBox, 'span', '', '0');			// spans hold the category scores
		if (i == 5) spawn(pointsBox, 'div');		// last gets an extra div for TOTAL
    }

	for (let i = 0; i < 6; i++) {					// add 6 "cubes" that will contain 1 or 2 dice
		let c = spawn($('.dice_set'), 'div', 'cube'); // cubes will be a ref point for dice as they move
		let d = spawn(c, 'div', 'dice', '', (i < 2 ? 'toggle_faces();' : `in_out(${i - 1}, 0);`));
		for (let j = 0; j < 7; j++) {				// the first dice of each cube has 7 pips
			let pip = `pip ${j == 3 ? 'r1 r3 r5' : 'r6'}`; // classes assign pips to roll values 
			if (j % 4 == 1) pip += ' r2 r3';
			if (j < 2 || j > 4) pip += ' r4 r5';
			pip += `${j < 2 ? ' top' : j > 4 ? ' bottom' : ''}`; // classes also position the pips
			pip += `${!(j % 2.5 % 2) ? ' left' : j % 5 % 3 % 2 ? ' right' : ''}`;
			spawn(d, 'div', pip);
		}
		spawn(spawn(d, 'span', 'numeral'), 'p');	// the first dice of each cube also has numerals
		if (i > 1) spawn(c, 'div', 'dice', '', `in_out(${1 - i}, 0);`); // only last 4 get 2nd ghost dice
	}

	svg_inline($('.svg_scorecard'));
    svg_bg($('.svg_reset'));
    update_undone();
  }



function removeAnimations() {
	$all('.anim200ms, .anim500ms').forEach(e => {
		e.classList.remove('anim200ms','anim500ms');
	});
}

new ResizeObserver(() => {
	stretchToFit();
}).observe(document.body);

function stretchToFit() {
	removeAnimations();

	let prior = landscape;
	landscape = Math.floor(window.innerWidth / window.innerHeight);
	// determining the maximum 16x9 area to use (12.5 + 3.5 = 16, 12.5 - 3.5 = 9)
	let grit = landscape ? 3.5 : -3.5;
	grit = Math.min(window.innerWidth / (12.5 + grit), window.innerHeight / (12.5 - grit));
	document.documentElement.style.fontSize = `${grit}px`; // doc edit

	if (landscape != prior) hasButOnlyIf(document.documentElement, 'landscape', landscape);
}

function toggle_scorecard() {
	removeAnimations();
    // elements that change location
    $all('.card, .cube, .bigbutton').forEach(e => { e.classList.add('anim500ms'); });
    scorecard = hasButOnlyIf($('.rex'), 'cardOut', !scorecard);
}

function undo_last() {
	let a = actions.length - 1;
	switch(actions[a][0]) {
		case 1:
			toggle_tile(actions[a][1], actions[a][2]);
			break;
		case 2:
			toggle_lock(actions[a][1], 0);
			break;
		case 3:
			toggle_penalty($('.penalty .tile'));
			break;
    }
}

function update_undone() {
	$('.svg_reset span').innerText = (undone++ > 99 ? '99+' : undone < 1 ? 'X' : undone); // doc edit
}



function toggle_faces() {
	use_numerals = hasButOnlyIf($('.dice_set'), 'numerals', !use_numerals);
}



  function in_out(i, source) {
    // i: which dice to be toggled out, negative means toggle back in
    // source 0: dice was clicked, so the scorecard should be updated
	// source 1: called by the scorecard when a color is removed there

    if (i > 0 && game_end) return;
    if (i < 0 && (dice_locked[4]) || dice_locked[-1 - i]) return;
    if (i < 0 && source < 1 && actions[actions.length - 1].toString() != `2,${Math.abs(i + 1)}`) return;

    let d = $('.dice_set').children[1 + Math.abs(i)];  // cube 3, 4, 5, or 6
    d.children[(i > 0 ? 0 : 1)].style.display = 'none'; // doc edit
    d.children[(i > 0 ? 1 : 0)].style.display = 'flex'; // doc edit

    if (source < 1) toggle_lock((Math.abs(i) - 1), 1);
  }

  function toggle_tile(stripe, tile) {

    console.log(`action: clicked on color ${($('.colormixx') ? mix_c[stripe][tile] : stripe)
      }, number ${($('.numbermixx') ? mix_n[stripe][tile] : stripe < 2 ? tile + 2 : 12 - tile)}`); 

    if (dice_locked[4]) return;

    let b = $('.scoring').children[stripe];
    let t = b.children[tile].children[0].classList;

    if (b.classList.contains('locked_stripe') && (tile < 10 || !t.contains('tile_on'))) return;
    if (t.contains('tile_off')) return;
    if (t.contains('tile_on') && undo < 1) return;

    if (t.contains('tile_on')) { console.log(`try: unselect (${stripe}, ${tile})`);

      if (actions[actions.length - 1].toString() != `1,${stripe},${tile}`) { console.log(`not last actionn`);
      } else { actions.splice(-1);

      if (tile > 9) { dice_locked[stripe] = !dice_locked[stripe]; toggle_lock(stripe, 2); }

        t.remove('tile_on'); undo -= consume; update_undone();

        while (tile > 0) {
          tile--; b.children[tile].children[0].classList.remove('tile_off');
          if (b.children[tile].children[0].classList.contains('tile_on')) tile = 0;
        }

        if (b.querySelectorAll('.tile_on').length < 5) {
          b.children[10].children[0].classList.add('tile_off');
        }
      }
    } else { console.log(`select (${stripe}, ${tile})`); actions.push([1, stripe, tile]);

      if (tile > 9) { dice_locked[stripe] = !dice_locked[stripe]; toggle_lock(stripe, 2); }

      t.add('tile_on');

      while (tile > 0) {
        tile--; b.children[tile].children[0].classList.add('tile_off');
        if (b.children[tile].children[0].classList.contains('tile_on')) tile = 0;
      }

      if (b.querySelectorAll('.tile_on').length > 4) {
        b.children[10].children[0].classList.remove('tile_off');
      }
    }

  update_points();
  }



  function toggle_lock(stripe, source) { console.log(`action: color ${stripe} lock`);

    let c = $all('.scoring .stripe, .penalty');
    let s = c[stripe].children[11].children[0].classList;

    if (c[stripe].classList.contains('locked_stripe') && !s.contains('tile_off')) return;
    if (s.contains('tile_off') && undo < 1 && source != 1) return;
    if (s.contains('tile_on') && !source) return;

    if (s.contains('tile_off')) { console.log(`try: color ${stripe} restore`);

      if (actions[actions.length - 1].toString() != `2,${stripe}` && source != 2) { console.log(`not last action`);
      } else {
        if (source != 1) in_out(-1 - stripe, 1);
        if (source != 2) actions.splice(-1);

        s.remove('tile_off', 'tile_on');

        game_end = false; //if (!source) { undo -= consume; update_undone() }

        for (let j = 0; j < 5; j++) {
          if (!c[j].lastChild.children[0].classList.contains('tile_off')) {
            c[j].classList.remove('locked_stripe');
          }
        }
      }
    } else { if (source < 2) actions.push([2, stripe]);

      console.log(`color ${stripe} remove by ${(source < 1 ? 'lock' : source < 2 ? 'dice' : 'selection')}`);

      s.add('tile_off'); if (source > 1) s.add('tile_on');
      if (source != 1) in_out(stripe + 1, 1);
      c[stripe].classList.add('locked_stripe');

      if ($all('.locked_stripe').length > 1) {
        game_end = true;
        for (let j = 0; j < 5; j++) c[j].classList.add('locked_stripe');
      }
    }

  update_points();
  }



  function toggle_penalty(e) { console.log(`action: clicked on penalty meter`);

    let b = $all('.scoring .stripe', '.penalty');
    let p = $('.penalty');

    if (p.classList.contains('locked_stripe')) return;
    if (e.classList.contains('tile_on') && undo < 1) return;

    if (e.classList.contains('tile_on')) { console.log(`try: unselect penalty`);

      if (actions[actions.length - 1][0] != [3]) { console.log(`not last action`);
      } else { actions.splice(-1);

        penalties--;
        p.children[penalties].classList.remove('tile_on');
        dice_locked[4] = game_end = false; undo -= consume; update_undone();

        for (let j = 0; j < 4; j++) {
          if (!b[j].lastChild.children[0].classList.contains('tile_off')) {
            b[j].classList.remove('locked_stripe');
          }
        }
      }
    } else { console.log(`select penalty`); actions.push([3]);

      p.children[penalties].classList.add('tile_on');
      penalties++;

      if (penalties > 3) {
        dice_locked[4] = game_end = true;
        for (let j = 0; j < 4; j++) b[j].classList.add('locked_stripe');
      }
    }

  update_points();
  }



function update_points() {
	let scoringStripe = $all('.scoring .stripe');
	let points = $all('.points .tile span');

	let total = -5 * penalties;
	points[4].textContent = -1 * total; // doc edit

	for (let i = 0; i < 4; i++) {
		let j = scoringStripe[i].querySelectorAll('.tile_on').length; // dirty
		let subTotal = 0;
		while (j > 0) subTotal += j--; // scoring uses tringle numbers
		points[i].textContent = subTotal; // doc edit
		total += subTotal;
	}
	
	points[5].textContent = total; // doc edit
	hasButOnlyIf(points[5].parentElement, 'tile_on', game_end);
}



  function shaker() {

	/* if not yet shaken, blank the dice */

    if (seed < 0) {

      $all('.dice p').forEach(e => { e.textContent = ''; }); // doc edit
      $all('.dice').forEach(e => { e.classList.remove('r1','r2','r3','r4','r5','r6'); });

      $('.roll').style.opacity = 1; // doc edit
      seed = 0;
    }

	/* each shake is added to the previous */

    shake_count++;
    let hashes = xmur3(String(Date.now() / shake_count));
    let rand = sfc32(hashes(), hashes(), hashes(), hashes());
    seed = (seed + rand()) % 1;

	/* shaking the dice jiggles them */

    jiggle();
  }



  function jiggle() {

    removeAnimations();

	$all('.dice:nth-child(1)').forEach(e => {
      e.classList.add('anim200ms');
      e.style.left = `${.9 * (Math.random() - .5)}em`; // doc edit
	  
	  // To start, dice are 1em apart, so they can jiggle +/- .45em without bumping.
	  // But on the scorecard, there is less space vertically between each of them.
	  // The vertical jiggle on the card should be 1/2 of that shown on the dice mat.
	  // PROBLEM: Chrome will animate changes in children elements after the parents.
	  // If the parent is relocated, style & rule changes to children animate later. 
	  // Example: https://jsfiddle.net/Barnyard/ot51db4x/8/
	  // SOLUTION: Set vertical jiggle with relative (em) and absolute (rem) values.
	  // So as the parent scale shrinks, the child vertical jiggle shrinks even more.
	  
	  let v = .9 * (Math.random() - .5);
      e.style.top = `${1.75 * v}em`; // doc edit
      e.style.marginTop = `${-.75 * v}rem`; // doc edit
    });
  }



  function roller() {

    if (seed < 0) return;

    let rolled = Math.floor(seed * (6 ** 6)).toString(6).padStart(6, '0');

    removeAnimations();

    let d = $all('.dice:nth-child(1)')
	for (let i = 0; i < 6; i++) {
		
	  let r = parseInt(rolled.charAt(i)) + 1;
	  d[i].classList.add(`r${r}`);
	  d[i].children[7].children[0].textContent = r; // doc edit
	  
	  d[i].classList.add('anim200ms');
      d[i].style.top = d[i].style.left = d[i].style.margin = '0'; // doc edit
    }

    $('.roll').style.opacity = .3; // doc edit
    seed = -1;
  }



  function modal_to_reset(i) {

    if (i < 1) { // actions = [[0]]; //--------------use to prevent undos in turn mode
      $all('.modal, .reset').forEach(e => { e.style.visibility = 'visible'; }); // doc edit
    } else {
      $all('.modal, .reset').forEach(e => { e.style.visibility = 'hidden'; }); // doc edit
      if (i > 1) {
        clear_game();
		hasButOnlyIf($('.card'), 'colormixx', (i == 3));
		hasButOnlyIf($('.card'), 'numbermixx', (i == 4));
      }
    }
  }


function clear_game() {

  penalties = 0;
  game_end = false;
  actions = [[0]];
  for (let i = 0; i < 5; i++) dice_locked[i] = false;

  $all('.locked_stripe, .tile_on, .tile_off').forEach(e => { e.classList.remove('locked_stripe', 'tile_on', 'tile_off'); });
  $all('.scoring .stripe').forEach(e => { e.children[10].children[0].classList.add('tile_off'); });

  $all('.dice:nth-child(1)').forEach(e => { e.style.display = 'flex'; }); // doc edit
  $all('.dice:nth-child(2)').forEach(e => { e.style.display = 'none'; }); // doc edit

  update_points();
  undone = -1; update_undone();
}

//let ii = 0;
//for (let xx = 0; xx < 16; xx++) {
//  for (let yy = xx + 1; yy < 16; yy++) {
//    for (let zz = yy + 1; zz < 16; zz++) {
//      ii++;
//      console.log(`${xx} ${yy} ${zz} ---- ${ii}`);
//    }
//  }
//}
//console.log(ii);


function handleBackEvents() {
	window.history.pushState({}, '');
	window.addEventListener('popstate', () => {

		simpleToast(2000, 'Double tap BACK\r\nto exit the app [v1]');

		setTimeout(() => {
			window.history.pushState({}, '');
		}, 2000);
	});
}

/*	-------------------------------------
	not my code: MurmurHash3 + sfc32 PRNG
	------------------------------------- */

function xmur3(str) {
	for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = h << 13 | h >>> 19;
	} return function() {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return (h ^= h >>> 16) >>> 0;
	}
}

function sfc32(a, b, c, d) {
	return function() {
		a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
		var t = (a + b) | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = (c << 21 | c >>> 11);
		d = d + 1 | 0;
		t = t + d | 0;
		c = c + t | 0;
		return (t >>> 0) / 4294967296;
	}
}

/*	-------------------------------------
	register a service worker for offline
	------------------------------------- */

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('./service-worker.js');
}

