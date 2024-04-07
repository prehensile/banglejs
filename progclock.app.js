require("FontHaxorNarrow7x17").add(Graphics);


// monkeypatch buzz function. v==time
wOS.BUZZPIN = D6;
wOS.buzz = function(v, strength){
  console.log( "buzz", v, strength );
  return new Promise(function(resolve, reject) {
      v = v? v : 100;
      strength = 1.0 - strength;
      if (v<=50){
          digitalPulse(wOS.BUZZPIN,false,v);
          resolve();
      } else {
          analogWrite(wOS.BUZZPIN,strength);
          setTimeout(()=>{
            wOS.BUZZPIN.set();
            resolve();
          },v);
      }
  });
};

// monkeypatch brightness
wOS.brightness= function(v){
  //console.log( "brightness", v );
  v = v>1?1:v<0?0:v;
  if (v==0||v==1)
      digitalWrite(D12,v);
    else
      analogWrite(D12,v,{freq:144});
};


let ScreenWidth = g.getWidth(), CenterX = ScreenWidth / 2;
let ScreenHeight = g.getHeight(), CenterY = ScreenHeight / 2;

if (process.env.BOARD == "BANGLEJS") {
  CenterY += 10;
}

let bpp = 4; // powers of two work, 3=8 colors would be nice
const b = Graphics.createArrayBuffer(ScreenWidth, ScreenHeight, bpp, { msb: true });
function flip(pal) {
  g.drawImage({
    width: ScreenWidth,
    height: ScreenHeight,
    bpp: bpp,
    buffer: b.buffer,
    palette: pal
  }, 0, 0);
}

function hexToRgb(hex) {
  let x = [];
  hex = hex.replace('#', '');
  if (hex.length != 6) {
    hex = modifyHex(hex);
  }
  x.push(parseInt(hex.slice(0, 2), 16));
  x.push(parseInt(hex.slice(2, 4), 16));
  x.push(parseInt(hex.slice(4, 6), 16));
  return x;
}

function rgb888To565(rgb) {
  return (
     ((rgb[0] & 0xF8) << 8) |
     ((rgb[1] & 0xFC) << 3) |
     ((rgb[2] & 0xF8) >> 3)
  );
}

const themes = require("Storage").readJSON("themes.json");
const theme = themes["everforest"]["light"];

let thisPalette = [];
const colors = {};
let i = 0;
for (const key in theme.colors) {
  thisPalette.push(
    rgb888To565(
      hexToRgb(theme.colors[key])
    )
  );
  colors[key] = i;
  i++;
}
for (const key in theme.alias) {
  colors[key] = colors[theme.alias[key]];
}

while (thisPalette.length < 16) thisPalette.push(0);
thisPalette = Uint16Array(thisPalette);


const msPerDay = 86400000;
const msPerWeek = msPerDay * 7;

let outerRadius = Math.min(CenterX, CenterY) * 0.95;

const yearRingRadius = outerRadius * 0.9;
const monthRingRadius = outerRadius * 0.8;
const weekRingRadius = outerRadius * 0.7;
const dayRingRadius = outerRadius * 0.6;
const centerRadius = outerRadius * 0.5;

// used to draw hour & minute ticks around the edge of the face, 
// from outerRadius inwards
const innerRadiusMinute = outerRadius * 0.95;
const innerRadiusHour = outerRadius * 0.9;

let HourHandLength = outerRadius * 0.6;
let HourHandWidth = 2 * 5, halfHourHandWidth = HourHandWidth / 2;

let MinuteHandLength = outerRadius * 0.8;
let MinuteHandWidth = 2 * 5, halfMinuteHandWidth = MinuteHandWidth / 2;

let BoltRadius = 3;
let HandOffset = BoltRadius + 15;

let SecondHandLength = outerRadius * 0.9;
let SecondHandOffset = 10;

let twoPi = 2 * Math.PI, deg2rad = Math.PI / 180;
let Pi = Math.PI;
let halfPi = Math.PI / 2;

let sin = Math.sin, cos = Math.cos;

let sine = [0, sin(30 * deg2rad), sin(60 * deg2rad), 1];

let HandPolygon = [
  -sine[3], -sine[0], -sine[2], -sine[1], -sine[1], -sine[2], -sine[0], -sine[3],
  sine[0], -sine[3], sine[1], -sine[2], sine[2], -sine[1], sine[3], -sine[0],
  sine[3], sine[0], sine[2], sine[1], sine[1], sine[2], sine[0], sine[3],
  0, 0,
  -sine[0], sine[3], -sine[1], sine[2], -sine[2], sine[1], -sine[3], sine[0]
];

let HourHandPolygon = new Array(HandPolygon.length);
for (let i = 0, l = HandPolygon.length; i < l; i += 2) {
  HourHandPolygon[i] = halfHourHandWidth * HandPolygon[i];
  HourHandPolygon[i + 1] = halfHourHandWidth * HandPolygon[i + 1];
  if (i < l / 2) { HourHandPolygon[i + 1] -= HourHandLength; }
  if (i > l / 2) { HourHandPolygon[i + 1] -= HandOffset; }
}

HourHandPolygon[25] = -BoltRadius;

let MinuteHandPolygon = new Array(HandPolygon.length);
for (let i = 0, l = HandPolygon.length; i < l; i += 2) {
  MinuteHandPolygon[i] = halfMinuteHandWidth * HandPolygon[i];
  MinuteHandPolygon[i + 1] = halfMinuteHandWidth * HandPolygon[i + 1];
  if (i < l / 2) { MinuteHandPolygon[i + 1] -= MinuteHandLength; }
  if (i > l / 2) { MinuteHandPolygon[i + 1] -= HandOffset; }
}
MinuteHandPolygon[25] = -BoltRadius;

/**** transforme polygon ****/

let transformedPolygon = new Array(HandPolygon.length);

function transformPolygon(originalPolygon, OriginX, OriginY, Phi) {
  let sPhi = sin(Phi), cPhi = cos(Phi), x, y;

  for (let i = 0, l = originalPolygon.length; i < l; i += 2) {
    x = originalPolygon[i];
    y = originalPolygon[i + 1];

    transformedPolygon[i] = OriginX + x * cPhi + y * sPhi;
    transformedPolygon[i + 1] = OriginY + x * sPhi - y * cPhi;
  }
}

/**** draw clock hands ****/


function getArcXY(centerX, centerY, radius, angle) {
  var s, r = [];
  // s = 2 * Math.PI * angle / 360;
  r.push(centerX + Math.round(Math.cos(angle) * radius));
  r.push(centerY + Math.round(Math.sin(angle) * radius));
  return r;
}
function getArc(centerX, centerY, radius, startAngle, endAngle) {
  var xy, r = [], actAngle = startAngle;
  //var stepAngle = (radius + radius) * Math.PI / 60;
  stepAngle = twoPi / 60;
  while (actAngle < endAngle) {
    r = r.concat(getArcXY(centerX, centerY, radius, actAngle));
    actAngle += stepAngle;
    actAngle = Math.min(actAngle, endAngle);
  }
  return r.concat(getArcXY(centerX, centerY, radius, endAngle));
}
function drawPiece(centerX, centerY, radius, startAngle, endAngle, gra) {
  startAngle -= halfPi;
  endAngle -= halfPi;
  var polyData = [centerX, centerY];
  polyData = polyData.concat(getArc(centerX, centerY, radius, startAngle, endAngle));
  gra.fillPoly(polyData, true);
}


function drawHand(angle, len, gra) {
  let sPhi = Math.sin(angle), cPhi = Math.cos(angle);
  gra.drawLine(
    CenterX,
    CenterY,
    CenterX - len * sPhi,
    CenterY + len * cPhi
  );
}


function drawTicks(gra) {
  const numTicks = 12 * 5;
  let a = 0;
  const angleStep = twoPi / numTicks;
  for (let i = 0; i < numTicks; i++) {
    r = (i % 5 == 0) ? innerRadiusHour : innerRadiusMinute;
    a = i * angleStep;
    gra.drawLine(
      CenterX + (Math.cos(a) * r),
      CenterY + (Math.sin(a) * r),
      CenterX + (Math.cos(a) * outerRadius),
      CenterY + (Math.sin(a) * outerRadius)
    );
  }
}


function drawRing(ringRadius, ringPecent, fgColour, bgColour, gra) {

  let endAngle = twoPi * ringPecent;
  let startAngle = 0;
  
  let fillColour = fgColour;
  let trackColour = bgColour;
  
  if( ringPecent > 0.5 ){
    // draw the other way round, looks nicer
    startAngle = endAngle;
    endAngle = twoPi;
    fillColour = bgColour;
    trackColour = fgColour;
  }

  // draw background for ring
  gra.setColor(trackColour);
  gra.fillCircle(CenterX, CenterY, ringRadius);

  // calculate and draw progess ring
  gra.setColor(fillColour);
  drawPiece(CenterX, CenterY, ringRadius, startAngle, endAngle, gra);

  // draw track edge
  gra.setColor(bgColour);
  gra.drawCircle(CenterX, CenterY, ringRadius);
}

function yearPercent(now) {
  const yearStart = new Date(now.getFullYear(), 0, 0);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 0);
  return (now - yearStart) / (yearEnd - yearStart);
}

function monthPercent(now) {
  const dtNextMonth = new Date(
    now.getFullYear(),
    (now.getMonth() + 1) % 12,
    0
  );
  const monthStart = new Date();
  monthStart.setDate(0);
  return ((now - monthStart) / (dtNextMonth - monthStart));
}

function drawBattery(tx, ty, lineColour, chargeColours, gra) {

  gra.setBgColor(lineColour);
  gra.drawImage(atob("EwuBAQAAL//1//6//8f/+P//H//j//x//6//9AAAgA=="), tx, ty);

  tx += 2;
  ty += 2;
  const charge = (E.getBattery() / 100);
  const w = 14 * charge;
  let battColour = chargeColours[0];
  // if( charge < 0.2 ) battColour = chargeColours[2];
  //else if (charge < 0.4) battColour = chargeColours[1];
  if (charge <= 0.2) battColour = chargeColours[2];
  gra.setColor(battColour);
  gra.fillRect(tx, ty, tx + w, ty + 6);
}

function drawBluetooth(tx, ty, colourOn, colourOff, gra) {
  let btColour = colourOff;
  if (NRF.getSecurityStatus().connected) {
    btColour = colourOn;
  }
  gra.setBgColor(btColour);
  gra.drawImage(atob("BguBAd89Vpc5Vtc9wA=="), tx, ty);
}

function drawClock(gra) {

  let now = new Date();

  let Hours = now.getHours() % 12;
  let Minutes = now.getMinutes();

  let HoursAngle = (Hours + (Minutes / 60)) / 12 * twoPi - Pi;
  let MinutesAngle = (Minutes / 60) * twoPi - Pi;

  let d = new Date();

  const pcMonth = monthPercent(d);
  const pcYear = yearPercent(d);

  d.setHours(0, 0, 0, 0);
  const dayPercent = (now.getTime() - d.getTime()) / msPerDay;

  const weekStartDate = d.getDate() - d.getDay();
  d.setDate(weekStartDate);
  const weekPercent = (now.getTime() - d.getTime()) / msPerWeek;

  // draw a background for the whole face
  gra.setColor(colors.faceBg);
  if (process.env.BOARD == "BANGLEJS") {
    gra.fillCircle(CenterX, CenterY, outerRadius);
  } else {
    gra.fillRect(0, 0, ScreenWidth, ScreenHeight);
  }

  gra.setColor(colors.faceFg);
  drawTicks(gra);

  drawRing(yearRingRadius, pcYear, colors.trackYear, colors.trackBg1, gra);
  drawRing(monthRingRadius, pcMonth, colors.trackMonth, colors.trackBg2, gra);
  drawRing(weekRingRadius, weekPercent, colors.trackWeek, colors.trackBg1, gra);
  drawRing(dayRingRadius, dayPercent, colors.trackDay, colors.trackBg2, gra);

  gra.setColor(colors.faceBg);
  gra.fillCircle(CenterX, CenterY, centerRadius);

  // draw date in a window
  gra.setFont("HaxorNarrow7x17");
  let tx = CenterX * 1.2;
  let ty = CenterY - 7;
  gra.setColor(colors.faceFg);
  gra.fillRect(tx - 2, ty - 2, tx + 14 + 1, ty + 17 + 2);
  gra.setColor(colors.faceBg);
  gra.drawString(
    now.getDate().toString().padStart(2, '0'),
    tx, ty
  );
  
  // draw digital time
  const ts = now.getHours().toString().padStart(2, '0') +
        ":" +
        now.getMinutes().toString().padStart(2, '0');
  gra.setColor(colors.faceFg);
  gra.drawString(
    ts,
    CenterX - 12,
    CenterY + (17*1.5)
  );

  // TODO: show day of the week

  // battery status
  tx = CenterX * 0.65;
  ty = CenterY - 4;

  drawBattery(
    tx, ty,
    colors.faceFg,
    [colors.battHigh, colors.battMed, colors.battLow],
    gra
  );

  drawBluetooth(tx + 22, ty, colors.btOn, colors.btOff, gra);

  // draw hands and lozenges
  gra.setColor(colors.faceFg);

  drawHand(HoursAngle, HourHandLength, gra);
  drawHand(MinutesAngle, MinuteHandLength, gra);

  transformPolygon(HourHandPolygon, CenterX, CenterY, HoursAngle);
  gra.fillPoly(transformedPolygon, true);

  transformPolygon(MinuteHandPolygon, CenterX, CenterY, MinutesAngle);
  gra.fillPoly(transformedPolygon, true);

  // drawSecondHand( SecondsAngle );

  gra.fillCircle(CenterX, CenterY, BoltRadius);

}
const buzzChars = [
  ".,-",    //weak
  ":;="  // strong
];
function buzzForMinute(m) {
  let pattern = "";
  let buzzChar = ",";
  if (m == 0) {
    pattern = pattern.padStart(4, buzzChar);
  } else if (m == 15) {
    pattern = pattern.padStart(1, buzzChar);
  } else if (m == 30) {
    pattern = pattern.padStart(2, buzzChar);
  } else if (m == 45) {
    pattern = pattern.padStart(3, buzzChar);
  }
  require("buzz").pattern(pattern);
  console.log("buzzForMinute:", m, pattern);
}

/**** refreshDisplay ****/

let Timer = null;
const updateMs = 1000 * 60;
let lastBuzzedQuarter = -1;

function refreshDisplay() {
  
  if(Timer) clearTimeout(Timer);
  
  if(Bangle.isLCDOn()){
    drawClock(b);
    flip(thisPalette);
  }

  const d = new Date();
  const h = d.getHours();
  if ((h > 7) && (h < 23)) {
    const m = d.getMinutes();
    const q = Math.floor(m / 15);
    if (q != lastBuzzedQuarter) {
      Bangle.setLCDPower(1);
      setTimeout(function () {
        buzzForMinute(q * 15);  // wrap buzzForMinute in a setTimeout so it doesn't get blocked by screen drawing 
      }, 10);
      lastBuzzedQuarter = q;
    }
  }

  let Pause = updateMs - (Date.now() % updateMs);
  Timer = setTimeout(refreshDisplay, Pause);
}

// Show launcher when button pressed
Bangle.setUI("clock");

b.clear(true);
b.setColor(colors.faceFg);
b.fillRect(0, 0, ScreenWidth, ScreenHeight);
b.setColor(colors.faceBg);
drawTicks(b);
flip(thisPalette);

//g.clear(true);

Bangle.on('lcdPower',p=>{
  if(p) refreshDisplay();
});

setTimeout(refreshDisplay, 10);                 // enqueue first draw request


