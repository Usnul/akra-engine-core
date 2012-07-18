function Skin (pMesh, pSkeleton) {
	debug_assert(pMesh, 'you must specify mesh for skin');

	this._pMesh = pMesh;
	this._pSkeleton = null;
	this._pBoneTransformMatrices = null;

	if (pSkeleton) {
		this.setSkeleton(pSkeleton);
	}

    this._pInfMetaData = null;
    this._pInfData = null;
    this._pWeightData = null;

    //список всех VertexData, к которым подвязан данный скин
    this._pTiedData = [];
}

PROPERTY(Skin, 'data',
    function () {
        return this._pMesh.data;
    });

PROPERTY(Skin, 'skeleton',
    function () {
        return this._pSkeleton;
    });

Skin.prototype.hasSkeleton = function() {
    return this._pSkeleton !== null;
};

Skin.prototype.getSkeleton = function() {
    return this._pSkeleton;
};


Skin.prototype.setSkeleton = function(pSkeleton) {
    debug_assert(this._pSkeleton === null, 'skin already have skeleton');

    this._pSkeleton = pSkeleton;

    var pData = this._pMesh.data;
    var iData = pData.allocateData(VE_MAT4('BONE_MATRIX'), 
        pSkeleton.getTransformationMatricesData());

    this._pBoneTransformMatrices = pData.getData(iData);
};

//загрузить веса вершин
Skin.prototype.setWeights = function (pWeights) {
    'use strict';
    
    this._pWeightData = this.data._allocateData([
        VE_FLOAT('BONE_WEIGHT')             //веса вершин
        ], pWeights);

    return this._pWeightData !== null;
};

Skin.prototype.getWeights = function () {
    'use strict';
    
    return this._pWeightData;
};

//разметка влияний на вершины
//пары: {число влияний, адресс индексов влияний}
Skin.prototype.getInfluenceMetaData = function () {
    'use strict';  
    return this._pInfMetaData;
};

//инф. о вляиниях на вершины
//пары: {индекс матрицы кости, индекс веса}
Skin.prototype.getInfluences = function (first_argument) {
    'use strict';
    return this._pInfData;
};

//задать влияния костей на вершины
Skin.prototype.setIfluences = function (pInfluencesCount, pInfluences) {
    'use strict';
    
    debug_assert(this._pInfMetaData == null && this._pInfData == null, 
        'vertex weights already setuped.')

    debug_assert(this.getWeights(), 'you must set weight data before setup influences');

    var pData = this.data;
    var pInfluencesMeta = new Float32Array(pInfluencesCount.length * 2);
    var iInfLoc = 0;
    var iTransformLoc = 0;
    var iWeightsLoc = 0;

    //получаем копию массива влияний
    pInfluences = new Float32Array(pInfluences);

    //вычисляем адресса матриц транфсормации и весов
    iTransformLoc = this._pBoneTransformMatrices.getOffset() / a.DTYPE.BYTES_PER_FLOAT;
    iWeightsLoc = this._pWeightData.getOffset() / a.DTYPE.BYTES_PER_FLOAT;


    for (var i = 0, n = pInfluences.length; i < n; i += 2) {
        pInfluences[i] = pInfluences[i] * 16 + iTransformLoc;
        pInfluences[i + 1] += iWeightsLoc;
    };
    

    //запоминаем модифицированную информацию о влияниях
    this._pInfData = pData._allocateData([
        VE_FLOAT('BONE_INF_DATA'),          //адрес матрицы кости
        VE_FLOAT('BONE_WEIGHT_IND')         //адрес весового коэффициента
        ], 
        pInfluences);

    iInfLoc = this._pInfData.getOffset() / a.DTYPE.BYTES_PER_FLOAT;

    //подсчет мета данных, которые укажут, где взять влияния на кость..
    for (var i = 0, j = 0, n = iInfLoc; i < pInfluencesMeta.length; i += 2) {
        var iCount = pInfluencesCount[j ++];
        pInfluencesMeta[i] = iCount;        //число влияний на вершину
        pInfluencesMeta[i + 1] = n;         //адресс начала информации о влияниях 
                                            //(пары индекс коэф. веса и индекс матрицы)
        n += 2 * iCount;
    };

    //influences meta: разметка влияний
    this._pInfMetaData = pData._allocateData([
        VE_FLOAT('BONE_INF_COUNT'),         //число костей и весов, влияющих на вершину
        VE_FLOAT('BONE_INF_LOC'),           //адресс начала влияний на вершину
        ], pInfluencesMeta);

    return this._pInfMetaData !== null && 
            this._pInfData !== null;
};

Skin.prototype.setVertexWeights = function(pInfluencesCount, pInfluences, pWeights) {
    debug_assert(arguments.length > 1, 'you must specify all parameters');

    //загружаем веса 
    if (pWeights) {
        this.setWeights(pWeights);
    }

    return this.setIfluences(pInfluencesCount, pInfluences);
};

Skin.prototype.applyBoneMatrices = function() {
    debug_assert(this._pSkeleton, 'mesh does not have any skeleton data');

    var pData;
    var bResult;

    if (this._pSkeleton.isUpdated()) {
        this._pSkeleton.synced();
        pData = this._pSkeleton._pBoneTransformsData;

        bResult = this._pBoneTransformMatrices.setData(pData, 0, pData.byteLength);

        return bResult;
    }

    return false;
};

//все матрицы транфсофрмации костей
Skin.prototype.getBoneTransforms = function () {
    'use strict';
    
    return this._pBoneTransformMatrices;
};

Skin.prototype.isAffect = function (pData) {
    'use strict';
    
    for (var i = 0; i < this._pTiedData.length; i++) {
        if (this._pTiedData[i] === pData) {
            return true;
        }
    };

    return false;
};

Skin.prototype.bind = function (pData) {
    'use strict';
    
    debug_assert(pData.stride === 16, 'you cannot add skin to mesh with POSITION: {x, y, z}' + 
        '\nyou need POSITION: {x, y, z, w}'); 
    
    pData.getVertexDeclaration().append(VE_FLOAT(a.DECLUSAGE.BLENDMETA, 12));

    this._pTiedData.push(pData);
};

Skin.debugMeshSubset = function (pSubMesh) {

        var pMesh = pSubMesh.mesh;
        var pSkin = pSubMesh.skin;
        var pMatData = pSkin.getBoneTransforms();
        var pPosData = pSubMesh.data.getData('POSITION');
        var pEngine = pMesh.getEngine();
        
        pPosData = pPosData.getTypedData(a.DECLUSAGE.BLENDMETA);

        var pVideoBuffer = pSubMesh.mesh.data.buffer;
        var iFrom = 2618, iTo = 2619;
        var pWeights = pSkin.getWeights().getTypedData('BONE_WEIGHT');
        //trace(pWeights);
        trace('===== debug vertices from ', iFrom, 'to', iTo, ' ======');
        trace('transformation data location:', pMatData.getOffset() / 4.);
        trace('155 weight: ',pSkin.getWeights().getTypedData('BONE_WEIGHT')[155]);
        trace('vertices info ===================>');
        for (var i = iFrom; i < iTo; i ++) {
            trace(pPosData[i], '<< inf meta location');
            var pMetaData = new Float32Array(pVideoBuffer.getData(4 * pPosData[i], 8));
            trace(pMetaData.X, '<< count');
            trace(pMetaData.Y, '<< inf. location');

            for (var j = 0; j < pMetaData.X; ++ j) {
                var pInfData = new Float32Array(pVideoBuffer.getData(4 * (pMetaData.Y + 2 * j), 8));

                trace(pInfData.X, '<< matrix location');
                trace(pInfData.Y,'/',pInfData.Y - 30432, '<< weight location / index');

                var pWeightData = new Float32Array(pVideoBuffer.getData(4 * (pInfData.Y), 4));
                trace(pWeightData[0], '<< weight');

                var pMatrixData = new Float32Array(pVideoBuffer.getData(4 * (pInfData.X), 4 * 16));

                trace(Mat4.str(pMatrixData));
            }
        }

        trace('#############################################');

        for (var i = 0; i < pPosData.length; i ++) {
            var pMetaData = new Float32Array(pVideoBuffer.getData(4 * pPosData[i], 8));
            for (var j = 0; j < pMetaData.X; ++ j) {
                var pInfData = new Float32Array(pVideoBuffer.getData(4 * (pMetaData.Y + 2 * j), 8));
                var iWeightsIndex = pInfData.Y - 30432;
             
                var fWeightOrigin = pWeights[iWeightsIndex];
                var pWeightData = new Float32Array(pVideoBuffer.getData(4 * (pInfData.Y), 4));
                var fWeight = pWeightData[0];
                    
                if (Math.abs(fWeight - fWeightOrigin) > 0.001) {
                    alert(1);
                    trace('weight with index', iWeightsIndex, 'has wrong weight', fWeightOrigin,'/',fWeightOrigin);
                }    
                 
                //var pWeightData = new Float32Array(pVideoBuffer.getData(4 * (pInfData.Y), 4));
                //var pMatrixData = new Float32Array(pVideoBuffer.getData(4 * (pInfData.X), 4 * 16));
            }
        }

        trace ('##############################################');
        // var pBoneTransformMatrices = pSkin._pBoneTransformMatrices;
        // var pBonetmData = pBoneTransformMatrices.getTypedData('BONE_MATRIX'); 

        // for (var i = 0; i < pBonetmData.length; i += 16) {
        //     trace('bone transform matrix data >>> ');
        //     trace(Mat4.str(pBonetmData.subarray(i, i + 16)));
        // };
         
        
        //for (var i = 0; i < pMesh.length; i++) {
        // var i = pMesh.length - 1;
        //     var pPosData = pMesh[i].data.getData('POSITION').getTypedData('POSITION');
        //     var pIndData = pMesh[i].data._pIndexData.getTypedData('INDEX0');
      
        //     var j = pIndData[pIndData.length - 1];
        //     var j0 = pMesh[i].data.getData('POSITION').getOffset()/4;   

        //     j -= j0;
        //     j/=4;

        //     trace('last index >> ', j);
        //     trace('pos data size', pPosData.length);

        //     var pVertex = pPosData.subarray(j * 3, j * 3 + 3);

        //     trace('last vertex in submesh >> ', pVertex[0], pVertex[1], pVertex[2]);

        //         var pSceneNode = pEngine.appendMesh(
        //             pEngine.pCubeMesh.clone(a.Mesh.GEOMETRY_ONLY|a.Mesh.SHARED_GEOMETRY),
        //             pEngine.getRootNode());

        //         pSceneNode.setPosition(pVertex);   
        //         pSceneNode.setScale(0.1);
        //     var pMeta = pSkin.getInfluenceMetaData().getTypedData('BONE_INF_COUNT');
        //     trace(pMeta[j], 'count << ');

        //};
}

A_NAMESPACE(Skin);