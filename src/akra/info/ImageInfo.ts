﻿
module akra.info {
	//FIXME: move determImageExtension to Image codec
	export function determImageExtension(url: string, cb: (e: Error, pData: Uint8Array, sExt: string) => void) {
		io.fopen(url, EIO.IN | EIO.BIN).read((e: Error, pData: ArrayBuffer) => {
			if (isNull(e)) {
				var pU8Data = new Uint8Array(pData);
				cb(null, pU8Data, readInfoFromData(pU8Data));
			}
			else {
				cb(e, null, null);
			}
		});
	}

	function str(pData: Uint8Array, iOffset: uint = 0, iLength: uint = pData.length): string {
		pData = pData.subarray(iOffset, iOffset + iLength);

		var s = "";

		for (var i = 0; i < pData.length; ++i) {
			s += String.fromCharCode(pData[i]);
		}

		return s;
	}

	function readInfoFromData(pData: Uint8Array): string {

		var offset = 0;

		if (pData[0] == 0xFF && pData[1] == 0xD8) {
			return "JPG";
		}

		if (pData[0] == 0x89 && str(pData, 1, 3).toUpperCase() == "PNG") {
			return "PNG";
		}

		if (str(pData, 0, 3).toUpperCase() == "GIF") {
			return "GIF";
		}

		if (pData[0] == 0x42 && pData[1] == 0x4D) {
			return "BMP";
		}

		return null;
	}

}