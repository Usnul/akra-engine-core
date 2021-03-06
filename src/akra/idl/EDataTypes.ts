module akra {
	export enum EDataTypes {
	    BYTE = 0x1400,
	    UNSIGNED_BYTE = 0x1401,
	    SHORT = 0x1402,
	    UNSIGNED_SHORT = 0x1403,
	    INT = 0x1404,
	    UNSIGNED_INT = 0x1405,
	    FLOAT = 0x1406
	}
	
	export enum EDataTypeSizes {
	    BYTES_PER_BYTE = 1,
	    BYTES_PER_UNSIGNED_BYTE = 1,
	    BYTES_PER_UBYTE = 1,
	
	    BYTES_PER_SHORT = 2,
	    BYTES_PER_UNSIGNED_SHORT = 2,
	    BYTES_PER_USHORT = 2,
	
	    BYTES_PER_INT = 4,
	    BYTES_PER_UNSIGNED_INT = 4,
	    BYTES_PER_UINT = 4,
	
	    BYTES_PER_FLOAT = 4
	}
}
