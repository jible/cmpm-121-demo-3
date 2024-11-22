// @deno-types="npm:@types/leaflet@^1.9.14"
// --------------------------IMPORTS
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { point, tooltip } from "npm:@types/leaflet@^1.9.14";
import { Board } from "./board.ts"
// ----------------------------Classes/interfaces


interface Player{
  position: leaflet.LatLng;
  coins: Coin[];
  marker: leaflet.marker;
  move(direction: string) : void
}

interface Cell{
  i:number;
  j:number;
}


interface Coin{
  serial: string;
}

class Cache {
  coins: number|string;
  constructor(coins: number ){
    this.coins = coins;
  }

  toMomento(){
    this.coins = this.coins.toString()
  }
  fromMomento(momento:string){
    this.coins = parseInt(momento);
  }
}



// ---------------------------CONSTANTS and Element References
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const WORLD_ORIGIN = leaflet.latLng(0,0)
const startPos= OAKES_CLASSROOM


// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;


const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "No points yet...";

for (const id of ["north", "south", "east", "west"]){
  const button = document.getElementById(id)
  button && button.addEventListener("click",()=>{
    player.move(id)
  })
}

// ---------------------------- SET UP MAP
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);


  
// ---------------------------------------SET UP PLAYER AND BOARD

const player :Player = {
  position: startPos,
  coins: [],
  marker: leaflet.marker(startPos, {
    tooltip: "That's you!"
  }).addTo(map),

  move(direction){
    const dirToVector: Dictionary = {
      "north": [0,1],
      "south" : [0,-1],
      "east" : [1, 0],
      "west": [-1,0]
    }
    const currentPosition = player.position
    console.log('pos',currentPosition)
    console.log('lat',currentPosition.lat)
    const lat = currentPosition.lat + dirToVector[direction][1] * TILE_DEGREES;
    const lng = currentPosition.lng + dirToVector[direction][0] * TILE_DEGREES;
    console.log('new lat',lat)
    player.position = leaflet.latLng(lat, lng)
    document.dispatchEvent(playerMoved)
  }
}


const board = new Board(TILE_DEGREES,NEIGHBORHOOD_SIZE);



// Add caches to the map by cell numbers

updateCache()

// -------------------------------HELPER FUNCTIONS
function spawnCache(i: number, j: number) {
  
  const origin = WORLD_ORIGIN;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    const pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    const cache = new Cache(pointValue);
    

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `<div>There is a cache here at "${i},${j}". It has value <span id="value">${cache.coins}</span>.</div><button id="poke">poke</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#poke")!
      .addEventListener("click", () => {
        if ( typeof(cache.coins) == 'number' && cache.coins  <= 0) {
          return;
        }
        if ( typeof(cache.coins) == 'number') {
          cache.coins-=1;
        }
        const coin : Coin ={
          serial: i.toString() + ":" + j.toString() + '#' + pointValue.toString()
        }
        player.coins.push(coin);
        popupDiv.querySelector<HTMLSpanElement>("#value")!.textContent = cache.coins.toString();
        statusPanel.innerHTML = `${player.coins.length} points accumulated`;
      });

    return popupDiv;
  });
}






function updateCache(){
  const localCells = board.getCellsNearPoint(player.position);
  for (const cell of localCells ){
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell.i, cell.j);
    }
  }
}



// -----------------------------------------EVENTS
const playerMoved = new CustomEvent('player-moved', {});

document.addEventListener('player-moved', ()=> {
  player.marker.setLatLng(player.position);
  map.panTo(player.position)
  // updateCache()
  // call me like this 
  //document.dispatchEvent(playerMoved);
});


// adding dictionary cause type script doesn't have dictionaries??
interface Dictionary {
  [key: string]: number[]; // keys are strings, values are numbers
}
