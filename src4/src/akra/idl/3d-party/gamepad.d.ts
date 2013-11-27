// Type definitions for Gamepad API
// Project: http://www.w3.org/TR/gamepad/
// Definitions by: Kon <http://phyzkit.net/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/**
 * This interface defines an individual gamepad device.
 */
interface Gamepad{
    /**
     * An identification string for the gamepad. This string identifies the brand or style of connected gamepad device. Typically, this will include the USB vendor and a product ID.
     * @readonly
     */
    id:string;
    
    /**
     * The index of the gamepad in the Navigator. When multiple gamepads are connected to a user agent, indices must be assigned on a first-come, first-serve basis, starting at zero. If a gamepad is disconnected, previously assigned indices must not be reassigned to gamepads that continue to be connected. However, if a gamepad is disconnected, and subsequently the same or a different gamepad is then connected, index entries must be reused. 
     * @readonly    
     */
    index:number;

    /**
     * Last time the data for this gamepad was updated. Timestamp is a monotonically increasing value that allows the author to determine if the axes and button data have been updated from the hardware, relative to a previously saved timestamp.
     * @readonly
     */
    timestamp:number;

    /**
     * Array of values for all axes of the gamepad. All axis values must be linearly normalized to the range [-1.0 .. 1.0]. As appropriate, -1.0 should correspond to "up" or "left", and 1.0 should correspond to "down" or "right". Axes that are drawn from a 2D input device should appear next to each other in the axes array, X then Y. It is recommended that axes appear in decreasing order of importance, such that element 0 and 1 typically represent the X and Y axis of a directional stick.
     * @readonly
     */
    axes:number[];

    /**
     * Array of values for all buttons of the gamepad. All button values must be linearly normalized to the range [0.0 .. 1.0]. 0.0 must mean fully unpressed, and 1.0 must mean fully pressed. It is recommended that buttons appear in decreasing importance such that the primary button, secondary button, tertiary button, and so on appear as elements 0, 1, 2, ... in the buttons array.
     * @readonly
     */
    buttons:number[];
}

/**
 *
 */
interface GamepadEvent extends Event{
    /**
     * The single gamepad attribute provides access to the associated gamepad data for this event.
     * @readonly
     */
    gamepad:Gamepad;
}

interface GamepadList{
    [index: number]: Gamepad;
    length: number;
}

interface Navigator{
    /**
     * The currently connected and interacted-with gamepads. Gamepads must only appear in the list if they are currently connected to the user agent, and have been interacted with by the user. Otherwise, they must not appear in the list to avoid a malicious page from fingerprinting the user based on connected devices.
     * @readonly
     */
    getGamepads(): Gamepad[];
    gamepads: Gamepad[];

    webkitGetGamepads(): GamepadList;
    
    // Not supported yet :(
    //　mozGetGamepads(): Gamepad[];
}

/*
 * @event gamepadconnected
 * A user agent must dispatch this event type to indicate the user has connected a gamepad. If a gamepad was already connected when the page was loaded, the gamepadconnected event will be dispatched when the user presses a button or moves an axis.
 */

/*
 * @event gamepaddisconnected 
 * When a gamepad is disconnected from the user agent, if the user agent has previously dispatched a gamepadconnected event, a gamepaddisconnected event must be dispatched.
 */