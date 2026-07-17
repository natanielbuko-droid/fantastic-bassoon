const expressionEl = document.getElementById("expression");
const currentEl = document.getElementById("current");

let firstOperand = null;
let operator = null;
let currentInput = "0";
let waitingForSecondOperand = false;

function updateDisplay() {
  currentEl.textContent = currentInput;
  if (operator && firstOperand !== null) {
    expressionEl.textContent = `${formatNumber(firstOperand)} ${symbolFor(operator)}`;
  } else {
    expressionEl.textContent = "";
  }
}

function symbolFor(op) {
  return { "+": "+", "-": "−", "*": "×", "/": "÷" }[op] || "";
}

function formatNumber(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "Błąd";
  return num.toLocaleString("pl-PL", { maximumFractionDigits: 10 });
}

function inputDigit(digit) {
  if (waitingForSecondOperand) {
    currentInput = digit;
    waitingForSecondOperand = false;
  } else {
    currentInput = currentInput === "0" ? digit : currentInput + digit;
  }
}

function inputDecimal() {
  if (waitingForSecondOperand) {
    currentInput = "0.";
    waitingForSecondOperand = false;
    return;
  }
  if (!currentInput.includes(".")) {
    currentInput += ".";
  }
}

function clearAll() {
  firstOperand = null;
  operator = null;
  currentInput = "0";
  waitingForSecondOperand = false;
}

function backspace() {
  if (waitingForSecondOperand) return;
  currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : "0";
}

function toggleSign() {
  if (currentInput === "0") return;
  currentInput = currentInput.startsWith("-") ? currentInput.slice(1) : "-" + currentInput;
}

function inputPercent() {
  currentInput = String(parseFloat(currentInput) / 100);
}

function compute(a, b, op) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function handleOperator(nextOperator) {
  const inputValue = parseFloat(currentInput);

  if (operator && waitingForSecondOperand) {
    operator = nextOperator;
    updateDisplay();
    return;
  }

  if (firstOperand === null) {
    firstOperand = inputValue;
  } else if (operator) {
    const result = compute(firstOperand, inputValue, operator);
    firstOperand = result;
    currentInput = String(result);
  }

  waitingForSecondOperand = true;
  operator = nextOperator;
  updateDisplay();
}

function handleEquals() {
  if (operator === null || waitingForSecondOperand) return;
  const inputValue = parseFloat(currentInput);
  const result = compute(firstOperand, inputValue, operator);
  currentInput = String(result);
  firstOperand = null;
  operator = null;
  waitingForSecondOperand = false;
  updateDisplay();
}

document.querySelector(".keys").addEventListener("click", (event) => {
  const target = event.target;
  if (!target.matches("button")) return;

  const { value, action } = target.dataset;

  if (value && !action) {
    if (/^[0-9]$/.test(value)) {
      inputDigit(value);
      updateDisplay();
    } else if (["+", "-", "*", "/"].includes(value)) {
      handleOperator(value);
    }
    return;
  }

  switch (action) {
    case "clear":
      clearAll();
      break;
    case "backspace":
      backspace();
      break;
    case "percent":
      inputPercent();
      break;
    case "decimal":
      inputDecimal();
      break;
    case "equals":
      handleEquals();
      break;
  }
  updateDisplay();
});

document.addEventListener("keydown", (event) => {
  const { key } = event;

  if (/^[0-9]$/.test(key)) {
    inputDigit(key);
    updateDisplay();
  } else if (["+", "-", "*", "/"].includes(key)) {
    handleOperator(key);
  } else if (key === "Enter" || key === "=") {
    event.preventDefault();
    handleEquals();
  } else if (key === "Backspace") {
    backspace();
    updateDisplay();
  } else if (key === "Escape") {
    clearAll();
    updateDisplay();
  } else if (key === "." || key === ",") {
    inputDecimal();
    updateDisplay();
  } else if (key === "%") {
    inputPercent();
    updateDisplay();
  }
});

updateDisplay();
