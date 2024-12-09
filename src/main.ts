// --------------------------IMPORTS
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

// ----------------------------INTERFACES and CLASSES
class EventManager {
  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    document.addEventListener(
      "player-moved",
      this.handlePlayerMoved.bind(this),
    );
    document.addEventListener("sensor-mode", this.handleSensorMode.bind(this));
    document.addEventListener("game-reset", this.handleGameReset.bind(this));
  }

  private handlePlayerMoved() {
    // Logic to update player's marker, pan map, etc.
    player.marker.setLatLng(player.position);
    map.panTo(player.position);
    updateDisplayedCaches();

    // Continue updating polyline data
    polyLineData.push([player.position.lat, player.position.lng]);

    if (currentPolyLine) {
      currentPolyLine.remove();
    }

    currentPolyLine = leaflet.polyline(polyLineData, { color: "red" }).addTo(
      map,
    );
  }

  private handleSensorMode() {
    // Implement any logic related to sensor mode here
    // This might involve toggling UI elements or updating states
  }

  private handleGameReset() {
    discardGameState();
  }
}

interface Player {
  position: leaflet.LatLng;
  coins: Coin[];
  marker: leaflet.marker;
}
interface Cell {
  i: number;
  j: number;
}
interface Coin {
  serial: string;
}
interface Cache {
  i: number;
  j: number;
  coins: number;
  rect: leaflet.rectangle;
}
interface Dictionary {
  [key: string]: number[];
}

// ---------------------------CONSTANTS
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const WORLD_ORIGIN = leaflet.latLng(0, 0);
const startPos = OAKES_CLASSROOM;

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// ---------------------------STATE VARIABLES
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
let realPositionMode = false;
let polyLineData = [[startPos.lat, startPos.lng]];
let currentPolyLine: leaflet.Polyline | null = null;
let loadedCaches: Cache[] = [];
let currentFrame = 0;

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// ---------------------------- SETUP MAP
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add map tiles
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// ---------------------------- PLAYER CONFIGURATION
const player: Player = {
  position: startPos,
  coins: [],
  marker: leaflet.marker(startPos, {
    tooltip: "That's you!",
  }).addTo(map),
};

// --------------------------- EVENT DECLARATIONS
const playerMoved = new CustomEvent("player-moved", {});
const enterSensorMode = new CustomEvent("sensor-mode", {});
const gameReset = new CustomEvent("game-reset", {});

// --------------------------- EVENT HANDLERS
const _eventManager = new EventManager();

// -------------------------- BUTTON EVENT SETUP
const moveButtons = ["north", "south", "east", "west"];
moveButtons.forEach((id) => {
  const button = document.getElementById(id);
  button && button.addEventListener("click", () => {
    handlePlayerMovement(player, id);
  });
});

const realPositionButton = document.getElementById("sensor");
realPositionButton &&
  realPositionButton.addEventListener("click", () => {
    realPositionMode = !realPositionMode;
    if (realPositionMode) {
      realPositionButton.classList.add("highlight");
      document.dispatchEvent(enterSensorMode);
    } else {
      realPositionButton.classList.remove("highlight");
    }
  });

const resetButton = document.getElementById("reset");
resetButton &&
  resetButton.addEventListener("click", () => {
    const sign = confirm(
      "Are you sure you want to delete all of your saved data?",
    );
    if (sign) {
      console.log(sign);
      localStorage.clear();
      document.dispatchEvent(gameReset);
      if (coinCollection) {
        coinCollection.innerHTML = "Coin Collection: <br>";
      }
    }
  });

const coinCollection = document.getElementById("coinCollection");

// --------------------------- PLAYER FUNCTIONS
function handlePlayerMovement(player: Player, direction: string) {
  const dirToVector: Dictionary = {
    north: [0, 1],
    south: [0, -1],
    east: [1, 0],
    west: [-1, 0],
  };

  // Calculate the new position based on the direction
  const currentPosition = player.position;
  const lat = currentPosition.lat + dirToVector[direction][1] * TILE_DEGREES;
  const lng = currentPosition.lng + dirToVector[direction][0] * TILE_DEGREES;

  // Update the player's position
  player.position = leaflet.latLng(lat, lng);

  // Dispatch the player-moved event
  document.dispatchEvent(playerMoved);
}

// --------------------------- CACHE FUNCTIONS
function toMemento(cache: Cache) {
  return cache.coins.toString();
}

function fromMemento(memento: string, i: number, j: number): Cache {
  return {
    i: i,
    j: j,
    coins: parseInt(memento),
    rect: null,
  };
}

function loadCache(i: number, j: number): Cache {
  const key = getCacheKey(i, j);
  const entry = localStorage.getItem(key);
  if (entry) {
    return fromMemento(entry, i, j);
  }
  return generateCache(i, j);
}

function generateCache(i: number, j: number): Cache {
  const pointValue = Math.floor(
    luck([i, j, "initialValue"].toString()) * 100,
  );
  return {
    i: i,
    j: j,
    coins: pointValue,
    rect: null,
  };
}

function saveCache(cache: Cache) {
  const key = getCacheKey(cache.i, cache.j);
  localStorage.setItem(key, toMemento(cache));
}

function spawnCache(i: number, j: number) {
  const cache = loadCache(i, j);
  renderCache(cache);
  return cache;
}

function addCacheRectangle(cache: Cache) {
  const origin = WORLD_ORIGIN;
  const bounds = leaflet.latLngBounds([
    [origin.lat + cache.i * TILE_DEGREES, origin.lng + cache.j * TILE_DEGREES],
    [
      origin.lat + (cache.i + 1) * TILE_DEGREES,
      origin.lng + (cache.j + 1) * TILE_DEGREES,
    ],
  ]);

  const rect = leaflet.rectangle(bounds);
  cache.rect = rect; // Store the rectangle in the cache object
  rect.addTo(map);

  return rect; // Return the rectangle for further manipulation
}

function bindCachePopup(rect: leaflet.Rectangle, cache: Cache) {
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${cache.i},${cache.j}". It has value <span id="value">${cache.coins}</span>.</div>
      <button id="poke">poke</button>`;

    popupDiv
      .querySelector<HTMLButtonElement>("#poke")!
      .addEventListener("click", () => {
        if (cache.coins <= 0) return;
        cache.coins -= 1;
        const coin: Coin = {
          serial: `${cache.i}:${cache.j}#${cache.coins}`,
        };
        player.coins.push(coin);
        saveCache(cache);

        // Update the pop-up content immediately
        const valueSpan = popupDiv.querySelector<HTMLSpanElement>("#value")!;
        valueSpan.textContent = cache.coins.toString();
        updatePointsText();
        saveLatestCoin();
        updateCoinCollectionDisplay();
      });

    return popupDiv;
  });
}

function renderCache(cache: Cache) {
  const rect = addCacheRectangle(cache); // Add rectangle
  bindCachePopup(rect, cache); // Bind the popup to the rectangle
}

// --------------------------- GAME STATE FUNCTIONS
function discardGameState() {
  player.coins = [];
  statusPanel.innerHTML = "No points yet...";
  loadedCaches.forEach((cache) => cache.rect.remove());
  loadedCaches = [];
  polyLineData = [[player.position.lat, player.position.lng]];
  updateDisplayedCaches();
  if (currentPolyLine) {
    currentPolyLine.remove();
    currentPolyLine = null;
  }
}

function updateDisplayedCaches() {
  loadedCaches.forEach((cache) => {
    saveCache(cache);
    cache.rect.remove();
  });
  loadedCaches = [];
  const localCells = board.getCellsNearPoint(player.position);
  localCells.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      loadedCaches.push(spawnCache(cell.i, cell.j));
    }
  });
}

// --------------------------- PLAYER COINS FUNCTIONS
function updatePointsText() {
  statusPanel.innerHTML = `${player.coins.length} points accumulated`;
}

function updateCoinCollectionDisplay() {
  if (!coinCollection) {
    console.error("no coin collection");
    return;
  }
  coinCollection.innerHTML = "Coin Collection: <br>"; // Clear existing display
  player.coins.forEach((coin) => {
    const div = document.createElement("div");
    div.innerText = "Coin: " + coin.serial;
    coinCollection.appendChild(div);
  });
}

function loadPlayerCoins() {
  for (let i = 0; true; i++) {
    const key = getCoinKey(i);
    const serial = localStorage.getItem(key);
    if (!serial) {
      updatePointsText();
      break;
    }
    const coin = { serial: serial };
    addCoinToDisplay(coin);
    player.coins.push(coin);
  }
}

function saveLatestCoin() {
  const index = player.coins.length - 1;
  const coin = player.coins[index];
  const key = getCoinKey(index);
  localStorage.setItem(key, coin.serial);
  addCoinToDisplay(coin);
}

function addCoinToDisplay(coin: Coin) {
  if (coinCollection) {
    const div = document.createElement("div");
    div.innerText = "Coin: " + coin.serial;
    coinCollection.appendChild(div);
  }
}

// --------------------------- UTILITY FUNCTIONS
function getCoinKey(i: number) {
  return `coin${i}`;
}

function getCacheKey(i: number, j: number): string {
  return `${i}:${j}`;
}

function getDistanceBetween(ax: number, ay: number, bx: number, by: number) {
  const xDiff = Math.abs(ax - bx);
  const yDiff = Math.abs(ay - by);
  return Math.max(xDiff, yDiff);
}

// -------------------------- MAIN GAME LOOP INIT
if (coinCollection) {
  coinCollection.innerHTML = "Coin Collection: <br>";
}
loadPlayerCoins();
polyLineData.push([player.position.lat, player.position.lng]);
currentPolyLine = leaflet.polyline(polyLineData, { color: "red" }).addTo(map);
updateCoinCollectionDisplay();
updateDisplayedCaches();
update();

function update(): void {
  currentFrame++;
  if (currentFrame > 10) {
    currentFrame = currentFrame % 10;
    if (realPositionMode) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const trueLat = position.coords.latitude;
          const trueLng = position.coords.longitude;
          const offset = getDistanceBetween(
            player.position.lat,
            player.position.lng,
            trueLat,
            trueLng,
          );
          if (offset > TILE_DEGREES / 2) {
            player.position = leaflet.latLng(trueLat, trueLng);
            document.dispatchEvent(playerMoved);
          }
        },
        (error) => {
          console.error("Error fetching location", error);
        },
      );
    }
  }
  requestAnimationFrame(update);
}
