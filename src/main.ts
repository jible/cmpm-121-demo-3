// @deno-types="npm:@types/leaflet@^1.9.14"

// --------------------------IMPORTS
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { point, tooltip } from "npm:@types/leaflet@^1.9.14";
import { Board } from "./board.ts";

// ----------------------------Classes/interfaces

interface Player {
  position: leaflet.LatLng;
  coins: Coin[];
  marker: leaflet.marker;
  move(direction: string): void;
}
interface Cell {
  i: number;
  j: number;
}
interface Coin {
  serial: string;
}
interface Cache { 
  i: number,
  j: number,
  coins: number;
  rect: leaflet.rectangle;
}

// Adding dictionary because TypeScript doesn't have dictionaries.
interface Dictionary {
  [key: string]: number[]; // keys are strings, values are arrays of numbers
}

// ---------------------------CONSTANTS and Element References

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const WORLD_ORIGIN = leaflet.latLng(0, 0);
const startPos = OAKES_CLASSROOM;

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const cacheCollection: Map<string, string> = new Map();
let loadedCaches: Cache[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";
let realPositionMode = false;

// Set up buttons
for (const id of ["north", "south", "east", "west"]) {
  const button = document.getElementById(id);
  button &&
    button.addEventListener("click", () => {
      player.move(id);
    });
}

const realPositionButton = document.getElementById("sensor");
realPositionButton && realPositionButton.addEventListener("click", () =>{
  realPositionMode = !realPositionMode;
  if (realPositionMode){
    // highlight the button
    // emit a signal that the game is in sensore mode
    realPositionButton.classList.add("highlight");
    document.dispatchEvent(enterSensorMode);
  } else {
    realPositionButton.classList.remove("highlight");
  }
})


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

const player: Player = {
  position: startPos,
  coins: [],
  marker: leaflet.marker(startPos, {
    tooltip: "That's you!",
  }).addTo(map),
  move(direction) {
    const dirToVector: Dictionary = {
      north: [0, 1],
      south: [0, -1],
      east: [1, 0],
      west: [-1, 0],
    };
    const currentPosition = player.position;
    const lat =
      currentPosition.lat + dirToVector[direction][1] * TILE_DEGREES;
    const lng =
      currentPosition.lng + dirToVector[direction][0] * TILE_DEGREES;

    player.position = leaflet.latLng(lat, lng);
    document.dispatchEvent(playerMoved);
  },
};

// -----------------------------------------EVENTS

const playerMoved = new CustomEvent("player-moved", {});
document.addEventListener("player-moved", () => {
  player.marker.setLatLng(player.position);
  map.panTo(player.position);
  updateDisplayedCaches();
});


const enterSensorMode = new CustomEvent("sensor-mode", {});
document.addEventListener("sensor-mode", () => {
  
});
// -------------------------------FUNCTIONS

function toMemento(cache: Cache) {
  return cache.coins.toString();
}

function fromMemento(memento: string, i:number, j:number): Cache {
  return {
    i:i,
    j:j,
    coins: parseInt(memento),
    rect: null,
  };
}

function loadCache(i: number, j: number): Cache {
  const key = getCacheKey(i,j)
  const entry = cacheCollection.get(key);
  if (entry) {
    return fromMemento(entry,i,j);
  }
  return generateCache(i, j);
}

function generateCache(i: number, j: number): Cache {
  const pointValue = Math.floor(
    luck([i, j, "initialValue"].toString()) * 100
  );
  const cache = {
    i: i,
    j: j,
    coins: pointValue,
    rect: null,
  };
  return cache;
}

function saveCache(cache: Cache) {
  const key = getCacheKey(cache.i,cache.j)
  cacheCollection.set(key, toMemento(cache));
}


function spawnCache(i: number, j: number) {
  const cache = loadCache(i, j);
  makeCacheRect(i, j, cache);
  return (cache);
}

function makeCacheRect(i: number, j: number, cache: Cache) {
  const origin = WORLD_ORIGIN;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);
  const rect = leaflet.rectangle(bounds);
  cache.rect = rect;
  rect.addTo(map);
  // Handle interactions with the cache
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `<div>There is a cache here at "${i},${j}". It has value <span id="value">${cache.coins}</span>.</div><button id="poke">poke</button>`;
    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#poke")!
      .addEventListener("click", () => {
        if (cache.coins <= 0) {
          return;
        }
        cache.coins -= 1;

        const coin: Coin = {
          serial:
            i.toString() +
            ":" +
            j.toString() +
            "#" +
            cache.coins.toString(),
        };
        player.coins.push(coin);
        popupDiv.querySelector<HTMLSpanElement>(
          "#value"
        )!.textContent = cache.coins.toString();
        statusPanel.innerHTML = `${player.coins.length} points accumulated`;
      });
    return popupDiv;
  });
}


function updateDisplayedCaches() {
  // Remove current caches 
  for (let cache of loadedCaches){
    saveCache(cache);
    cache.rect.remove(); // Removes the rectangle from the Leaflet map
  }
  loadedCaches = [];

  const localCells = board.getCellsNearPoint(player.position);
  for (const cell of localCells) {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      loadedCaches.push( spawnCache(cell.i, cell.j) );
    }
  }
}


function getCacheKey(i:number,j:number): string{
  return `${i}:${j}`
}

function getDistanceBetween(ax: number, ay:number, bx:number, by:number){
  // cheating this a little
  // im just gonna return which ever distance is bigger on x or y, rather than pythagorean theoreming this 
  const xDiff = Math.abs(ax - bx);
  const yDiff = Math.abs(ay - by);
  return xDiff>yDiff? xDiff:yDiff;
}


let currentFrame = 0;
function update(): void{
  currentFrame++;
  // This is a funny way of doing this but i figured its pretty expensive to do it every frame. 
  if (currentFrame > 10){
    currentFrame = currentFrame%10;
    console.log("Frame updated");
    if ( realPositionMode ){
      // get player position. If it is more than half of a cell away from the current position,
      // the position there and emit update position signal
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const trueLat = position.coords.latitude; // Latitude of the player
          const trueLng = position.coords.longitude; // Longitude of the player
          const offset = getDistanceBetween(player.position.lat, player.position.lng, trueLat, trueLng)

          if ( offset > TILE_DEGREES/2){
            player.position = leaflet.latLng(trueLat,trueLng);
            document.dispatchEvent(playerMoved);
          }


        },
        (error) => {
          console.error("Error fetching location", error);
        }
      );

    }
  }
  requestAnimationFrame(update);
}



// The actual play cycle
updateDisplayedCaches();
update();


