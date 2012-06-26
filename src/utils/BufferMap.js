/**
 * @file
 * @brief BufferMap class.
 * @author IvanPopov.
 * @email <vantuziast@odserve.org>
 */


/**
 * @inline-example
 * @inlineExample
 *
 * var pVert1:VertexData; // semantics: POSITION1, NORMAL1;
 * var pVert2:VertexData; // semantics: POSITION2, NORMAL2, TEXCOORD2;
 * var pVert3:VertexData; // semantics: POSITION3, TEXCOORD3, TANGENT3;
 *
 * var pIndices1:VertexData; //semantics: INDEX11, INDEX12
 * var pIndices2;VertexData; //semantics: INDEX21;
 *
 * var pMap = new a.BufferMap(pEngine);
 *
 * pMap.flow(0, pVert1);
 * pMap.flow(1, pVert2);
 * pMap.flow(2, pVert3);
 *
 * pMap.mapping(0, pIndices1, 'INDEX11');
 * pMap.mapping(1, pIndices1, 'INDEX12');
 * pMap.mapping(2, pIndices2, 'INDEX21');
 *
 * pMap.index = pIndexData;
 */


/**
 * BufferMap Class.
 * It is used for simplified operation with a large set of data flow effects,
 * as well as their dynamic markings (simulation of multi-index drawing).
 * @param pEngine Engine instance.
 * @ctor
 */
function BufferMap (pEngine) {
    this._pEngine = pEngine;

    /**
     * @enum
     * Data flow types.
     */
    Enum([
        FT_MAPPABLE = 1,    //!< The data stream can be marked up its index.
        FT_UNMAPPABLE = 0   //!< The data stream cannot be marked up its index.
    ], BUFFERMAP_FLOW_TYPES, a.BufferMap);

    /**
     * Pool of flows.
     * @type Array
     * @private
     */
    this._pFlows = null;

    /**
     * Pool of mappers.
     * @type Array
     * @private
     */
    this._pMappers = null;

    /**
     * Global index for rendering.
     * @type IndexData
     * @private
     */
    this._pIndex = null;

    /**
     * Number of elements for rendering without index.
     * @type Uint
     * @private
     */
    this._nLength = 0;

    /**
     * Type of primitives, that will be used in rendering.
     * @type PRIMITIVE_TYPE
     * @private
     */
    this._ePrimitiveType = a.PRIMTYPE.TRIANGLELIST;

    /**
     * Flows, thats ready for rendering.
     * @type Array
     * @private
     */
    this._pCompleteFlows = null;

    /**
     * Number of flows, thats ready for render.
     * @type Uint
     * @private
     */
    this._nCompleteFlows = 0;

    this._nCompleteVideoBuffers = 0;
    this._pCompleteVideoBuffers = null;

    /**
     * Starting index for rendering without using global index.
     * @type Uint
     * @private
     */
    this._nStartIndex = 0;

    /**
     * Activation table.
     * @type Object.
     * @private
     */
    this._pBuffersCompatibleMap = null;

    this.reset();
}

a.extend(BufferMap, a.ReferenceCounter);

/**
 * Current type of primitive which will be used for rendering.
 * @type PRIMITIVE_TYPE
 */
PROPERTY(BufferMap, 'primType',
    function () {
        return this._pIndex ? this._pIndex.getPrimitiveType() : this._ePrimitiveType;
    },
    function (eType) {
        this._ePrimitiveType = eType;
    });

PROPERTY(BufferMap, 'primCount',
    function () {
        if (this.primType === a.PRIMTYPE.TRIANGLELIST) {
            return this.length / 3.;
        }

        return undefined;
    });

/**
 * Current used index.
 * @note if index not use, will be returned null.
 * @type IndexData
 */
PROPERTY(BufferMap, 'index',
    function () {
        return this._pIndex;
    },
    function (pIndexData) {
        if (this._pIndex === pIndexData) {
            return;
        }
        this.draw = this.drawElements = pIndexData.drawElements;
        this._pIndex = pIndexData;
        this.update();
    });

/**
 * @type Uint
 * Maximum number of accepted flow.
 */
PROPERTY(BufferMap, 'limit', function () {
    return this._pFlows.length;
});

/**
 * @type Uint
 * Number of elements for rendering
 */
PROPERTY(BufferMap, 'length',
    function () {
        return (this._pIndex? this._pIndex.getCount(): this._nLength);
    },
    function (nLength) {
        this._nLength = Math.min(this._nLength, nLength);
    });

/**
 * @type Uint
 * Starting index for rendering without using global index.
 * @sa BufferMap.index
 */
PROPERTY(BufferMap, 'startIndex',
    function () {
        return this._nStartIndex;
    },
    function (nStartIndex) {
        debug_assert(this._nStartIndex === nStartIndex || this._nStartIndex === MAX_INT32,
            'You can not use a maps or unmappable buffers having different starting index.');
        this._nStartIndex = nStartIndex
    });

/**
 * @type uint
 * Number of data flows that ready for rendering.
 */
PROPERTY(BufferMap, 'size', function () {
    return this._nCompleteFlows;
});

/**
 * @type Array
 * Data flows.
 */
PROPERTY(BufferMap, 'flows', function () {
    return this._pCompleteFlows;
});

/**
 * @type Array
 * Data mappers.
 */
PROPERTY(BufferMap, 'mappers', function () {
    return this._pMappers;
});

/**
 * @type Uint
 * Offset(in bytes) of index(IndexData) used in BufferMap.
 * @sa BufferMap.index
 */
PROPERTY(BufferMap, 'offset', function () {
    return (this._pIndex? this._pIndex.getOffset(): 0);
});


/**
 * Reset BufferMap.
 * @note After reset, buffer map removing all early used Flows/Mappers.
 */
BufferMap.prototype.reset = function () {
    this._pIndex = null
    this._ePrimitiveType = a.PRIMTYPE.TRIANGLELIST;


    var pDevice = this._pEngine.pDevice;
    var nFlowLimit = Math.min(
        a.info.graphics.maxVertexTextureImageUnits(pDevice),
        a.info.graphics.maxVertexAttributes(pDevice)
    );

    this._pMappers = [];
    this._pFlows = new Array(nFlowLimit);
    for (var i = 0; i < nFlowLimit; i++) {
        this._pFlows[i] = {
            pData:  null,
            eType:  a.BufferMap.FT_UNMAPPABLE,
            pMapper:null
        };
    }

    this._nLength = MAX_INT32;
    this._pCompleteFlows = new Array(nFlowLimit);
    this._nCompleteFlows = 0;
    this._nStartIndex = MAX_INT32;
    this._pDevice = this._pEngine.pDevice;
    this._pBuffersCompatibleMap = {};

    this._pCompleteVideoBuffers = new Array(nFlowLimit);
    this._nCompleteVideoBuffers = 0;


    this.draw = this.drawArrays;
};

/**
 * Load data to flow.
 * @property flow(Uint iFlow, VertexData pVertexData)
 * @param iFlow Number of Stream.
 * @param pVertexData Data flow for this stream.
 * @treturn Boolean
 */
BufferMap.prototype.flow = function (iFlow, pVertexData) {
    var pFlow;
    
    if (arguments.length < 2) {
        iFlow = this._nCompleteFlows;
        pVertexData = arguments[0];
    }

    pFlow = this._pFlows[iFlow];

    debug_assert(iFlow < this.limit,
        'Invalid strem. Maximum allowable number of stream ' + this.limit + '.');

    if (!pVertexData || pFlow.pData === pVertexData) {
        return false;
    }

    if (pVertexData.buffer instanceof a.VertexBuffer) {
        pFlow.eType = a.BufferMap.FT_UNMAPPABLE;
        this.length = pVertexData.getCount();
        this.startIndex = pVertexData.getStartIndex();

        debug_assert(this.checkData(pVertexData),
            'You can use several unmappable data flows from one buffer.');

        this._pushEtalon(pVertexData);
    }
    else {
        pFlow.eType = a.BufferMap.FT_MAPPABLE;
    }

    pFlow.pData = pVertexData;

    return this.update();
};

/**
 * @property checkData(VertexData pData)
 * @param pData Data for checking. TRUE if data can be used in this map.
 * @treturn Boolean
 */
BufferMap.prototype.checkData = function (pData) {
    var pEtalon = this._pBuffersCompatibleMap[pData.resourceHandle()];
    if (!pEtalon || pEtalon.offset === pData.offset) {
        return true;
    }
    return false;
};

/**
 * Find mapping.
 * @property findMapping(VertexData pMap, DECLARATION_USAGE eSemantics);
 * @param pMap Map.
 * @param eSemantics Semantics in given map.
 * @treturn Object Mapping with this map and semantics or null.
 * @protected
 */
BufferMap.prototype.findMapping = function (pMap, eSemantics) {
    debug_assert(this.checkData(pMap), 'You can use several different maps from one buffer.');
    for (var i = 0, pMappers = this._pMappers, pExistsMap; i < pMappers.length; i++) {
        pExistsMap = pMappers[i].pData;
        if (pExistsMap === pMap) {
            if (pMappers[i].eSemantics === eSemantics) {
                return pMappers[i];
            }
        }
        else {
            debug_assert(pExistsMap.getStartIndex() === pMap.getStartIndex(),
                'You can not use maps with different indexing');
        }
    }

    return null;
};

/**
 * Setup mapping for given flow.
 * @property mapping(iFlow, pMap, eSemantics)
 * @param iFlow Number of data flow.
 * @param pMap  Map.
 * @param eSemantics Semantics in given map.
 * @treturn Boolean Result of mapping.
 */
BufferMap.prototype.mapping = function (iFlow, pMap, eSemantics) {
    var pMapper = this.findMapping(pMap, eSemantics);
    var pFlow = this._pFlows[iFlow];

    debug_assert(pFlow.pData && pFlow.eType === a.BufferMap.FT_MAPPABLE,
        'Cannot mapping empty/unmappable flow.');
    debug_assert(pMap, 'Passed empty mapper.');

    if (!eSemantics) {
        eSemantics = pMap.getVertexDeclaration()[0].eUsage;
    }
    else if (pMap.hasSemantics(eSemantics) === false) {
        debug_error('Passed mapper does not have semantics: ' + eSemantics + '.');
    }

    if (pMapper) {
        if (pFlow.pMapper === pMapper) {
            return false;
        }
    }
    else {
        pMapper = {pData: pMap, eSemantics: eSemantics};

        this._pMappers.push(pMapper);
        this.length = pMap.getCount();
        this.startIndex = pMap.getStartIndex();
        this._pushEtalon(pMap);
    }

    pFlow.pMapper = pMapper;

    return this.update();
};

BufferMap.prototype._pushEtalon = function (pData) {
    this._pBuffersCompatibleMap[pData.resourceHandle()] = pData;
};

//Define(BufferMap.hash(pMap, eSemantics), function () {
//    eSemantics + ((0x0000FFFF & pMap.toNumber()) | (pMap.resourceHandle() & 0xFFFF) << 16);
//});


/**
 * Update the current BufferMap.
 */
BufferMap.prototype.update = function () {
    var pFlows = this._pFlows;
    var pFlow, pMapper;
    var isMappable = false;
    var pCompleteFlows = this._pCompleteFlows;
    var nCompleteFlows = 0;
    var pCompleteVideoBuffers = this._pCompleteVideoBuffers;
    var nCompleteVideoBuffers = 0;
    var pVideoBuffer;
    var isVideoBufferAdded = false;

    for (var i = 0; i < pFlows.length; i++) {
        pFlow = pFlows[i];
        pMapper = pFlow.pMapper;
        isMappable = (pFlow.eType === a.BufferMap.FT_MAPPABLE);

        if (pFlow.pData === null || (isMappable && pMapper === null)) {
            continue;
        }

        pCompleteFlows[nCompleteFlows ++] = pFlow;

        if (isMappable) {
            pVideoBuffer = pFlow.pData.buffer;
            for (var j = 0; j < nCompleteVideoBuffers; j++) {
                if (pCompleteVideoBuffers[j] === pVideoBuffer) {
                    isVideoBufferAdded = true;
                    break;
                }
            }
            if (!isVideoBufferAdded) {
                pCompleteVideoBuffers[nCompleteVideoBuffers ++] = pVideoBuffer;
            }
        }
    }
    this._nCompleteFlows = nCompleteFlows;
    this._nCompleteVideoBuffers = nCompleteVideoBuffers;
};

BufferMap.prototype.draw = function () {};
BufferMap.prototype.drawElements = function () {};
BufferMap.prototype.drawArrays = function () {
    this._pDevice.drawArrays(this._ePrimitiveType, this._nStartIndex, this._nLength);
};


a.BufferMap = BufferMap;