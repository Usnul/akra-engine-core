/// <reference path="IEventProvider.ts" />
/// <reference path="IMap.ts" />

module akra {
	export enum ERPCPacketTypes {
		FAILURE,
		REQUEST,
		RESPONSE
	}
	
	export interface IRPCCallback {
		n: uint;
		fn: Function;
		timestamp: uint;
		procInfo?: string;
	}
	
	export interface IRPCPacket {
		n: uint;
		type: ERPCPacketTypes;
		next: IRPCPacket;
	}
	
	export interface IRPCRequest extends IRPCPacket {
		proc: string;
		argv: any[];
		//ms - life time
		lt: uint;
		pr: uint;
	}
	
	export interface IRPCResponse extends IRPCPacket  {
		//procedure result
		res: any;
	}
	
	export interface IRPCProcOptions {
		//-1 - unknown, 0 - immortal
		lifeTime?: int;
		priority?: uint;
	}
	
	export enum ERPCErrorCodes {
		STACK_SIZE_EXCEEDED,
		CALLBACK_LIFETIME_EXPIRED
	}

	export interface IRPCError extends Error {
		code: ERPCErrorCodes;
	}
	
	export interface IRPCOptions {
		addr?: string;
		deferredCallsLimit?: int;	        /* -1 - unlimited */
		maxCallbacksCount?: int;		    /* -1 - unlimited */
		reconnectTimeout?: int;		        /* -1 - never */
		systemRoutineInterval?: int;	    /* -1 - never*/
		callbackLifetime?: uint;		    /* 0 - immortal */
		procListName?: string;		        /* имя процедуры, для получения все поддерживаемых процедур */
		callsFrequency?: int;		        /* 0 or -1 - disable group calls */
		context?: any;				        /* контекст, у которого будут вызываться методы, при получении REQUEST запросов со стороны сервера */
		procMap?: IMap<IRPCProcOptions>;
	
	}
	
	export enum ERpcStates {
		//not connected
		k_Deteached,
		//connected, and connection must be established
		k_Joined,
		//must be closed
		k_Closing
	}
	
	
	export interface IRPC extends IEventProvider {
		getOptions(): IRPCOptions;
		getRemote(): any;
		getGroup(): int;                 //????

		join(sAddr?: string): void;
		rejoin(): void;
		free(): void;
		detach(): void;
		proc(...argv: any[]): boolean;

		groupCall(): int;           //??????
		dropGroupCall(): int;       //???????

		setProcedureOption(sProc: string, sOpt: string, pValue: any): void;

		joined: ISignal<{ (pRpc: IRPC): void; }>;
		error: ISignal<{ (pRpc: IRPC, e: Error): void; }>;
	}  
	
	
}
