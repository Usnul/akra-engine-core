var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", "fx/ExprInstruction"], function(require, exports, __ExprInstruction__) {
    var ExprInstruction = __ExprInstruction__;

    var MemExprInstruction = (function (_super) {
        __extends(MemExprInstruction, _super);
        function MemExprInstruction() {
            _super.call(this);
            this._pBuffer = null;
            this._pInstructionList = null;
            this._eInstructionType = 43 /* k_MemExprInstruction */;
        }
        MemExprInstruction.prototype.getBuffer = function () {
            return this._pBuffer;
        };

        MemExprInstruction.prototype.setBuffer = function (pBuffer) {
            this._pBuffer = pBuffer;
            this.setType(pBuffer.getType());
        };

        MemExprInstruction.prototype.addUsedData = function (pUsedDataCollector, eUsedMode) {
            if (typeof eUsedMode === "undefined") { eUsedMode = 3 /* k_Undefined */; }
            var pBufferType = this.getBuffer().getType();
            var pInfo = pUsedDataCollector[pBufferType._getInstructionID()];

            if (!isDef(pInfo)) {
                pInfo = {
                    type: pBufferType,
                    isRead: false,
                    isWrite: false,
                    numRead: 0,
                    numWrite: 0,
                    numUsed: 0
                };

                pUsedDataCollector[pBufferType._getInstructionID()] = pInfo;
            }
            if (eUsedMode !== 3 /* k_Undefined */) {
                pInfo.isRead = true;
                pInfo.numRead++;
            }

            pInfo.numUsed++;
        };
        return MemExprInstruction;
    })(ExprInstruction);

    
    return MemExprInstruction;
});
//# sourceMappingURL=MemExprInstruction.js.map