/// <reference path="ajax.ts" />
/// <reference path="exchange/Exporter.ts" />
/// <reference path="exchange/Importer.ts" />
/// <reference path="core/Engine.ts" />

module akra {
	export function createEngine(pOtions?: IEngineOptions): akra.IEngine {
		return new core.Engine(pOtions);
	}
}

