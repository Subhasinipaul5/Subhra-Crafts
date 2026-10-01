import { forwardRef } from "react";

// Fixes two long-standing browser-default annoyances with <input type="number">, everywhere in
// the admin:
//
// 1. Clicking in and typing normally INSERTS at the cursor position rather than replacing the
//    existing value - so a field showing "1" becomes "12" when you type "2", not "2". Selecting
//    the whole value on focus makes typing replace it instead, the way most spreadsheet/settings
//    UIs behave. This only fires on focus (not on every keystroke), so editing part of a number
//    with the cursor placed mid-value still works normally once you've clicked past the initial
//    focus - it doesn't fight the user or jump the cursor while they're typing.
//
// 2. Scrolling the mouse wheel while the input happens to have focus silently
//    increments/decrements the value in Chrome and Firefox. Blurring the input on wheel stops
//    that completely while leaving the page's own scroll totally unaffected - the blur happens
//    before the browser would apply the scroll-as-spinner behavior, and once blurred, that wheel
//    event (and every one after it) is just ordinary page scrolling again.
//
// A thin wrapper, not a replacement: still a real <input type="number">, so native decimal
// support (via `step`), the mobile numeric keypad, and any existing min/max/required validation
// all keep working exactly as before - nothing about the underlying value type changes. The
// spinner arrows are hidden via the `.no-spinner` CSS class (see index.css); that's purely
// cosmetic and isn't what fixes the wheel behavior above (hiding the arrows alone does NOT stop
// wheel-to-change in Chrome, which is why the onWheel handler does the real work).
const NumberInput = forwardRef(function NumberInput({ onFocus, onWheel, className = "", ...props }, ref) {
  return (
    <input
      type="number"
      ref={ref}
      className={`no-spinner ${className}`}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      onWheel={(e) => {
        e.target.blur();
        onWheel?.(e);
      }}
      {...props}
    />
  );
});

export default NumberInput;
