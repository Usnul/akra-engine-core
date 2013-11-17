/// <reference path="../idl/AIBox.ts" />

import logger = require("logger");
import gen = require("generate");

var pBuffer: AIBox[];
var iElement: uint;

class Box implements AIBox {
    left: uint = 0;
    top: uint = 0;
    front: uint = 0;
    right: uint = 0;
    bottom: uint = 0;
    back: uint = 0;

    /** inline */ get width(): uint {
        return this.right - this.left;
    }

    /** inline */ get height(): uint {
        return this.bottom - this.top;
    }

    /** inline */ get depth(): uint {
        return this.back - this.front;
    }

    constructor();
    constructor(pExtents: AIBox);
    constructor(iLeft: uint, iTop: uint, iFront: uint);
    constructor(iLeft: uint, iTop: uint, iRight: uint, iBottom: uint);
    constructor(iLeft: uint, iTop: uint, iFront: uint, iRight: uint, iBottom: uint, iBack: uint);
    constructor() {
        switch (arguments.length) {
            case 1:
                this.left = arguments[0].left;
                this.top = arguments[0].top;
                this.front = arguments[0].front;

                this.right = arguments[0].right;
                this.bottom = arguments[0].bottom;
                this.back = arguments[0].back;
                break;

            case 0:
                this.left = 0;
                this.top = 0;
                this.front = 0;

                this.right = 1;
                this.bottom = 1;
                this.back = 1;
                break;

            case 3:
                this.left = arguments[0];
                this.top = arguments[1];
                this.front = arguments[2];

                this.right = arguments[0] + 1;
                this.bottom = arguments[1] + 1;
                this.back = arguments[2] + 1;
                break;
            case 6:
                this.left = arguments[0];
                this.top = arguments[1];
                this.front = arguments[2];

                this.right = arguments[3];
                this.bottom = arguments[4];
                this.back = arguments[5];
                break;
            case 4:
                this.left = arguments[0];
                this.top = arguments[1];
                this.right = arguments[2];
                this.bottom = arguments[3];

                this.back = 1;
                this.front = 0;
                break;
            case 5:
                logger.error("invalid number of arguments");
        }

        logger.assert(this.right >= this.left && this.bottom >= this.top && this.back >= this.front);
    }

    contains(pDest: AIBox): boolean {
        return (pDest.left >= this.left && pDest.top >= this.top && pDest.front >= this.front &&
            pDest.right <= this.right && pDest.bottom <= this.bottom && pDest.back <= this.back);
    }

    setPosition(iLeft: uint, iTop: uint, iWidth: uint, iHeight: uint, iFront: uint = 0, iDepth: uint = 1): void {
        this.left = iLeft;
        this.top = iTop;
        this.right = iLeft + iWidth;
        this.bottom = iTop + iHeight;
        this.front = iFront;
        this.back = iFront + iDepth;
    }

    isEqual(pDest: AIBox): boolean {
        return (pDest.left == this.left && pDest.top == this.top && pDest.front == this.front &&
            pDest.right == this.right && pDest.bottom == this.bottom && pDest.back == this.back);
    }

    toString(): string {
        return "---------------------------\n" +
            "left: " + this.left + ", right: " + this.right + "\n" +
            "top: " + this.top + ", bottom: " + this.bottom + "\n" +
            "front: " + this.front + ", back: " + this.back + "\n" +
            "---------------------------";
    }

    static temp(): AIBox;
    static temp(pBox: AIBox): AIBox;
    static temp(iLeft: uint, iTop: uint, iFront: uint): AIBox;
    static temp(iLeft: uint, iTop: uint, iRight: uint, iBottom: uint): AIBox;
    static temp(iLeft: uint, iTop: uint, iFront: uint, iRight: uint, iBottom: uint, iBack: uint): AIBox;
    static temp(): AIBox {
        iElement = (iElement === pBuffer.length - 1 ? 0 : pBuffer.length);
        var pBox = pBuffer[iElement++];

        var iLeft: uint = 0,
            iTop: uint = 0,
            iFront: uint = 0,
            iWidth: uint = 0,
            iHeight: uint = 0,
            iDepth: uint = 0;

        switch (arguments.length) {
            case 1:
                iLeft = arguments[0].left;
                iTop = arguments[0].top;
                iFront = arguments[0].front;
                iWidth = arguments[0].width;
                iHeight = arguments[0].height;
                iDepth = arguments[0].depth;
                break;
            case 0:
                iLeft = 0;
                iTop = 0;
                iFront = 0;
                iWidth = 1;
                iHeight = 1;
                iDepth = 1;
                break;
            case 3:
                iLeft = arguments[0];
                iTop = arguments[1];
                iFront = arguments[2];
                iWidth = arguments[0] + 1;
                iHeight = arguments[1] + 1;
                iDepth = arguments[2] + 1;
                break;
            /*case 0:
        case 3:
        case 6:
            pBox.setPosition(l, t, r - l, b - t, ff, bb - ff);
            break;
        case 4:
            pBox.setPosition(l, t, arguments[2] - l, arguments[3]- t, 0, 1);
            break;
        default:
            ERROR("Inavlid number of arguments");*/
            case 6:
                iLeft = arguments[0];
                iTop = arguments[1];
                iFront = arguments[2];
                iWidth = arguments[3] - arguments[0];
                iHeight = arguments[4] - arguments[1];
                iDepth = arguments[5] - arguments[2];
                break;
            case 4:
                iLeft = arguments[0];
                iTop = arguments[1];
                iFront = 0;
                iWidth = arguments[2] - arguments[0];
                iHeight = arguments[3] - arguments[1];
                iDepth = 1;
                break;
            default:
                logger.error("Inavlid number of arguments");
                return null;
        }

        pBox.setPosition(iLeft, iTop, iWidth, iHeight, iFront, iDepth);

        return pBox;
    }
}

pBuffer = gen.array<AIBox>(20, Box);
iElement = 0;

export = Box;