// todo
const bodyElement = document.body;

const button = document.createElement("button");

// Step 3: Set the button's properties
button.textContent = "Click Me!";
button.id = "myButton"; // Optional: set id
button.className = "button-class"; // Optional: set class

button.addEventListener("click", () => {
  alert("Button was clicked!");
});
// Step 4: Append the button to the body
bodyElement.appendChild(button);
