 
 'use strict';

  let $ = (selectors) => document.querySelector(selectors);
  let $id = id => document.getElementById(id);
  let $all = (selectors) => document.querySelectorAll(selectors);



  /*--------------------------------------------------------
  - Simple vector images can be included inline and reused as needed.
  - SVG files are text readable and included as template literals.
  - These can be easily parsed into data files for image backgrounds.
  - On page load, they are assigned to all elements with a matching class.
  - So, these classes should not be added to an element's class list later.
  - Color can be changed dynamically: https://codepen.io/sosuke/pen/Pjoqqp */

  const svg = new Map();

  svg.set('svg_scorecard',
  `<svg viewBox='0 0 24 24' stroke='#333' stroke-linejoin='round' stroke-linecap='round'>
    <path d='M5 13h5m-5 3h13M15 4.5h-12.5v15h18v-6M13 11v2h2l7-7-2-2zM18 6l2 2' fill='none'/>
  </svg>`);

  svg.set('svg_reset',
  `<svg viewBox='0 0 24 24' stroke='#333' stroke-linecap='round'>
    <path id='a' d='M5.6 3.3v2.5h2.5M5.6 5.6A9 9 0 0120.9 13.6' fill='none'/>
    <g transform='rotate(180 12 12)'><use href='#a'/></g>
  </svg>`);



  var pwa = document.location.href.toString().includes('user_mode=app');

  var landscape = -1;	 			/* landscape unknown */
  var seed = -1;				/* indicates dice not shaken yet */
  var dice_locked = new Array(5).fill(0);	/* for dice locked by card selections */
  var use_numerals = 0;				/* pips are displayed by defualt */

  var shake_count = 0;
  var scorecard = 0;
  var penalties = 0;
  var game_end = 0;

  var undo = 1;
  var consume = 0;
  var undone = -1;

  var actions = [[0]];

  const mix_c = [
    [2,2,2,4,4,4,3,3,3,1,1],
    [1,1,3,3,3,3,4,4,2,2,2],
    [4,4,4,2,2,2,1,1,1,3,3],
    [3,3,1,1,1,1,2,2,4,4,4] ];

  const mix_n = [
    [ 10,  6,  2,  8,  3,  4, 12,  5,  9,  7, 11],
    [  9, 12,  4,  6,  7,  2,  5,  8, 11,  3, 10],
    [  8,  2, 10, 12,  6,  9,  7,  4,  5, 11,  3],
    [  5,  7, 11,  9, 12,  3,  8, 10,  2,  6,  4] ];



  window.onload = populate();



  function toast(t, msg) {

    let e = $('.toast');
    e.style.visibility = 'visible';
    e.innerText = msg;

    setTimeout(() => { e.style.visibility = 'hidden'; }, t);
  }



  function svg_bg(e) {

    let c = Array.from(e.classList).find(x => x.includes('svg_'));
    if (!svg.get(c))  { console.log (`SVG for ${c} not found`); return; }

    // make SVG compliant, then URI encode < > #, then remove line breaks

    let bg = svg.get(c).replace(`<svg`, `<svg xmlns='http://www.w3.org/2000/svg'`);
    bg = bg.replace(/[<>#]/g, encodeURIComponent);
    bg = bg.replace(/[\r\n]/g, '');

    e.style.backgroundImage = `url("data:image/svg+xml,${bg}")`;

  }



  function populate() {

    if (pwa) {
      handleBackEvents(); //------------------------------------------------------------------------------------
    }


    let s = $all('.score.bar');
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 12; j++) {
        s[i].appendChild(document.createElement('div'));
        s[i].children[j].className = 'mixxbg';

        s[i].children[j].appendChild(document.createElement('div'));

        s[i].children[j].children[0].className = 'tile' + (j == 10 ? ' tile_off' : '');
        s[i].children[j].children[0].setAttribute('onclick',`toggle_tile(${i}, ${j});`);
        s[i].children[j].children[0].appendChild(document.createElement('span'));
        s[i].children[j].children[0].children[0].appendChild(document.createElement('p'));
        s[i].children[j].children[0].children[0].children[0].innerText = (i < 2 ? j + 2 : 12 - j);
        s[i].children[j].children[0].children[0].appendChild(document.createElement('p'));
        s[i].children[j].children[0].children[0].children[1].innerText = (j < 11 ? mix_n[i][j] : 'X') ;
      }
      s[i].children[11].children[0].className += ' lock';
      s[i].children[11].children[0].children[0].children[0].innerText = 'X';
      s[i].children[11].children[0].setAttribute('onclick',`toggle_lock(${i}, 0);`);
    }

    let p = $('.penalty');
    for (let i = 0; i < 4; i++) {
      p.appendChild(document.createElement('div'));
      p.children[i].className = 'tile';
      p.children[i].setAttribute('onclick',`toggle_penalty(this);`);
      p.children[i].appendChild(document.createElement('span'));
      p.children[i].children[0].appendChild(document.createElement('p'));
    }

    let t = $('.points');
    for (let i = 0; i < 6; i++) {
      t.appendChild(document.createElement('div'));
      t.children[i].className = 'tile';
      t.children[i].appendChild(document.createElement('span'));
      t.children[i].children[0].innerText = '0';
    }
    t.children[5].appendChild(document.createElement('div'));


    /*--------------------------------------------------------
    - The dice set contains 6 cubes, and each cube contains 1 or 2 dice.
    - The last 4 cubes are given 2 dice, since colored dice have a shadow element.
    - The first 2 cubes contain 1 dice each that toggle numeral faces on click.
    - The first dice of each cube contains 7 pips and then a numeral.
    - The pips are given positions on the dice derived from an index count. */


    let d = $('.dice_set');
    for (let i = 0; i < 6; i++) {
      let c = document.createElement('div');
      c.className = 'cube';

      for (let j = 0; j * 4 < i + 3; j++) {
        let e = document.createElement('div');
        e.className = 'dice';
        e.setAttribute('onclick',`in_out(${(i - 1) * (j ? -1 : 1)}, 0);`);
        if (i < 2) e.setAttribute('onclick', 'toggle_faces();');
        c.appendChild(e);
      }
      for (let j = 0; j < 7; j++) {
        let e = document.createElement('div');
        e.className = 'pip';
        e.className += `${j < 2 ? ' top' : j > 4 ? ' bottom' : ''}`;
        e.className += `${!(j % 2.5 % 2) ? ' left' : j % 5 % 3 % 2 ? ' right' : ''}`;
		e.className += ` ${j == 3 ? 'r1 r3 r5' : 'r6'}`;
		if (j % 4 == 1) e.className += ' r2 r3';
		if (j < 2 || j > 4) e.className += ' r4 r5';
        c.children[0].appendChild(e);
      }
      c.children[0].appendChild(document.createElement('span'));
      c.children[0].children[7].className = 'numeral';
      c.children[0].children[7].appendChild(document.createElement('p'));
      d.appendChild(c);
    }

    $all('[class*="svg_"]').forEach(e => { svg_bg(e); });
    show_undone();

  }



  new ResizeObserver(() => {

    stretch_to_fit();

  }).observe(document.body);



  function stretch_to_fit() {

    let grit = document.documentElement.style;
    let prior = landscape;

    landscape = Math.floor(window.innerWidth / window.innerHeight);
    if (landscape) {
      grit.fontSize = `${Math.min(window.innerHeight / 9, window.innerWidth / 16)}px`;
    } else {
      grit.fontSize = `${Math.min(window.innerHeight / 16, window.innerWidth / 9)}px`;
    }

    remove_animations();

    if (landscape != prior) {
      $('.rex').style.transform = `rotate(${ landscape ? -90 : 0 }deg)`;
      let flip = $all('.dice, .bigbutton, .tile');
      flip.forEach(e => { e.style.transform = `rotate(${ landscape ? 90 : 0 }deg)`; });
    }

  }



  function remove_animations() {

    $all('.anim200ms, .anim500ms').forEach(e => {
      e.classList.remove('anim200ms','anim500ms');
    });

  }



  function in_out(i, source) {

    if (i > 0 && game_end) return;
    if (i < 0 && (dice_locked[4]) || dice_locked[-1 - i]) return;
    if (i < 0 && source < 1 && actions[actions.length - 1].toString() != `2,${Math.abs(i + 1)}`) return;

    let d = $('.dice_set').children[1 + Math.abs(i)];
    d.children[(i > 0 ? 0 : 1)].style.display = 'none';
    d.children[(i > 0 ? 1 : 0)].style.display = 'flex';

    if (source < 1) toggle_lock((Math.abs(i) - 1), 1);

  }



  function toggle_faces() {
    use_numerals = 1 - use_numerals;
    let d = $all('.numeral');
    d.forEach(i => { i.style.opacity = use_numerals; });
  }



  function undo_last() {

    switch(actions[actions.length - 1][0]) {
      case 1:
        toggle_tile(actions[actions.length - 1][1], actions[actions.length - 1][2]);
        break;
      case 2:
        toggle_lock(actions[actions.length - 1][1], 0);
        break;
      case 3:
        toggle_penalty($('.penalty .tile'));
        break;
    }
  }



  function show_undone() {
    undone++;
    $('.svg_reset span').innerText = (undone > 99 ? '99+' : undone < 1 ? 'X' : undone);
  }



  function toggle_scorecard() {

    remove_animations();

    // does splitting the animation from the on/off class fix it? nope. must fix this

    //$all('.card, .cube, .bigbutton, .text1').forEach(i => { i.classList.add('anim500ms'); });

    let e = $all('.card, .cube, .bigbutton, .text1'); // chrome animates children AFTER parents

    e.forEach(i => { i.classList.add('anim500ms'); });

    if (scorecard) {
      e.forEach(i => { i.classList.remove('card_out'); });
    } else {
      e.forEach(i => { i.classList.add('card_out'); });
    }

    $('.dicepad').style.opacity = scorecard;
    scorecard = 1 - scorecard;

  }



  function toggle_tile(bar, tile) {

    console.log(`action: clicked on color ${($('.colormixx') ? mix_c[bar][tile] : bar + 1)
      }, number ${($('.numbermixx') ? mix_n[bar][tile] : bar < 2 ? tile + 2 : 12 - tile)}`); 

    if (dice_locked[4]) return;

    let b = $('.card').children[bar + 1];
    let t = b.children[tile].children[0].classList;

    if (b.classList.contains('locked_bar') && (tile < 10 || !t.contains('tile_sel'))) return;
    if (t.contains('tile_off')) return;
    if (t.contains('tile_sel') && undo < 1) return;

    if (t.contains('tile_sel')) { console.log(`try: unselect (${bar}, ${tile})`);

      if (actions[actions.length - 1].toString() != `1,${bar},${tile}`) { console.log(`not last actionn`);
      } else { actions.splice(-1);

      if (tile > 9) { dice_locked[bar] = !dice_locked[bar]; toggle_lock(bar, 2); }

        t.remove('tile_sel'); undo -= consume; show_undone();

        while (tile > 0) {
          tile--; b.children[tile].children[0].classList.remove('tile_off');
          if (b.children[tile].children[0].classList.contains('tile_sel')) tile = 0;
        }

        if (b.querySelectorAll('.tile_sel').length < 5) {
          b.children[10].children[0].classList.add('tile_off');
        }
      }
    } else { console.log(`select (${bar}, ${tile})`); actions[actions.length] = [1, bar, tile];

      if (tile > 9) { dice_locked[bar] = !dice_locked[bar]; toggle_lock(bar, 2); }

      t.add('tile_sel');

      while (tile > 0) {
        tile--; b.children[tile].children[0].classList.add('tile_off');
        if (b.children[tile].children[0].classList.contains('tile_sel')) tile = 0;
      }

      if (b.querySelectorAll('.tile_sel').length > 4) {
        b.children[10].children[0].classList.remove('tile_off');
      }
    }

  update_points();
  }



  function toggle_lock(bar, source) { console.log(`action: color ${bar} lock`);

    let c = $('.card');
    let s = c.children[bar + 1].children[11].children[0].classList;

    if (c.children[bar + 1].classList.contains('locked_bar') && !s.contains('tile_off')) return;
    if (s.contains('tile_off') && undo < 1 && source != 1) return;
    if (s.contains('tile_sel') && !source) return;

    if (s.contains('tile_off')) { console.log(`try: color ${bar} restore`);

      if (actions[actions.length - 1].toString() != `2,${bar}` && source != 2) { console.log(`not last action`);
      } else {
        if (source != 1) in_out(-1 - bar, 1);
        if (source != 2) actions.splice(-1);

        s.remove('tile_off', 'tile_sel');

        game_end = 0; //if (!source) { undo -= consume; show_undone() }

        for (let j = 0; j < 5; j++) {
          if (!c.children[j + 1].lastChild.children[0].classList.contains('tile_off')) {
            c.children[j + 1].classList.remove('locked_bar');
          }
        }
      }
    } else { if (source < 2) actions[actions.length] = [2, bar];

      console.log(`color ${bar} remove by ${(source < 1 ? 'lock' : source < 2 ? 'dice' : 'selection')}`);

      s.add('tile_off'); if (source > 1) s.add('tile_sel');
      if (source != 1) in_out(bar + 1, 1);
      c.children[bar + 1].classList.add('locked_bar');

      if ($all('.locked_bar').length > 1) {
        game_end = 1;
        for (let j = 0; j < 5; j++) c.children[j + 1].classList.add('locked_bar');
      }
    }

  update_points();
  }



  function toggle_penalty(e) { console.log(`action: clicked on penalty meter`);

    let b = $all('.score', '.penalty');
    let p = $('.penalty');

    if (p.classList.contains('locked_bar')) return;
    if (e.classList.contains('tile_sel') && undo < 1) return;

    if (e.classList.contains('tile_sel')) { console.log(`try: unselect penalty`);

      if (actions[actions.length - 1][0] != 3) { console.log(`not last action`);
      } else { actions.splice(-1);

        penalties--;
        p.children[penalties].classList.remove('tile_sel');
        dice_locked[4] = game_end = 0; undo -= consume; show_undone()

        for (let j = 0; j < 4; j++) {
          if (!b[j].lastChild.children[0].classList.contains('tile_off')) {
            b[j].classList.remove('locked_bar');
          }
        }
      }
    } else { console.log(`select penalty`); actions[actions.length] = [3];

      p.children[penalties].classList.add('tile_sel');
      penalties++;

      if (penalties > 3) {
        dice_locked[4] = game_end = 1;
        for (let j = 0; j < 4; j++) b[j].classList.add('locked_bar');
      }
    }

  update_points();
  }



  function update_points() {

    let b = $all('.score');
    let p = $all('.points > .tile');

    let s = -5 * penalties;
    p[4].children[0].textContent = -1 * s;

    for (let j = 0; j < 4; j++) {
      let k = b[j].querySelectorAll('.tile_sel').length;
      let r = 0; while (k > 0) r += k--;
      p[j].children[0].textContent = r; s += r;
    }

    p[5].children[0].textContent = s;

    p[5].style.opacity = game_end;

  }



  function shaker() {

	/* if not yet shaken, blank the dice */

    if (seed < 0) {

      $all('.numeral p').forEach(e => { e.textContent = ''; });
      $all('.dice').forEach(e => { e.classList.remove('r1','r2','r3','r4','r5','r6'); });

      $('.roll').style.opacity = 1;
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

    remove_animations();

    $all('.dice:nth-child(1)').forEach(e => {
      e.classList.add('anim200ms');
      e.style.left = `${.9 * (Math.random() - .5)}em`;
	  
	  // To start, dice are 1em apart, so they can jiggle +/- .45 em without bumping.
	  // But on the scorecard, there is less distance between each vertically.
	  // The vertical jiggle on the card should be 1/2 of that shown on the dice mat.
	  // PROBLEM: Chrome will animate changes in children elements after the parents.
	  // If the parent is relocated, style & rule changes to children animate after. 
	  // example: https://jsfiddle.net/Barnyard/ot51db4x/8/
	  // SOLUTION: Set vertical jiggle with relative (em) and absolute (rem) values.
	  // As the parent scale shrinks, the child vertical jiggle shrinks more.
	  
	  let v = .9 * (Math.random() - .5);
      e.style.top = `${1.75 * v}em`;
      e.style.marginTop = `${-.75 * v}rem`;
    });
  }



  function reveal_face(i, j) {
    let d = $('.dice_set').children[i].children[0];
    d.classList.add(`r${j}`);
	d.children[7].children[0].textContent = (j);
  }



  function roller() {

    if (seed < 0) return;

    let rolled = Math.floor(seed * (6 ** 6)).toString(6).padStart(6, '0');

    remove_animations();

    let d = $all('.dice:nth-child(1)');
    for (let i = 0; i < 6; i++) {
      reveal_face(i, parseInt(rolled.charAt(i)) + 1);
      d[i].classList.add('anim200ms');
      d[i].style.top = d[i].style.left = d[i].style.margin = '0';
    }

    $('.roll').style.opacity = .3;
    seed = -1;

  }


  function modal_to_reset(i) {

    if (i < 1) { // actions = [[0]]; //--------------use to prevent undos in turn mode
      $all('.modal, .reset').forEach(e => { e.style.visibility = 'visible'; });
    } else {
      $all('.modal, .reset').forEach(e => { e.style.visibility = 'hidden'; });
      if (i > 1) {
        clear_game();
        $('.card').classList.remove('colormixx','numbermixx');
        if (i == 3) $('.card').classList.add('colormixx');
        if (i == 4) $('.card').classList.add('numbermixx');
      }
    }
  }


  function clear_game() {

    penalties = 0;
    game_end = 0;
    actions = [[0]];
    for (let i = 0; i < 5; i++) dice_locked[i] = 0;

    let c = $all('.locked_bar, .tile_sel, .tile_off');
    c.forEach(e => { e.classList.remove('locked_bar','tile_sel','tile_off'); });
    $all('.score').forEach(e => { e.children[10].children[0].classList.add('tile_off'); });

    $all('.dice:nth-child(1)').forEach(e => { e.style.display = 'flex'; });
    $all('.dice:nth-child(2)').forEach(e => { e.style.display = 'none'; });

    update_points();
    undone = -1; show_undone();

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

    toast(2000, 'Double tap BACK\r\nto exit the app');

    setTimeout(() => {
      window.history.pushState({}, '');
    }, 2000);
  });
}

/* -------------------------------------
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

/* -------------------------------------
   register a service worker for offline
   ------------------------------------- */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

