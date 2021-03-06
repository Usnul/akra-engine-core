

/// <reference path="INode.ts" />
/// <reference path="IJoint.ts" />

module akra {
	export interface IJointMap {
		[index: string]: IJoint;
	}
	
	
	
	export interface ISkeleton {
		getTotalBones(): int;
		getTotalNodes(): int;
		getName(): string;
		getRoot(): IJoint;
	
		getRootJoint(): IJoint;
		getRootJoints(): IJoint[];
		getJointMap(): IJointMap;
		getNodeList(): ISceneNode[];
		addRootJoint(pJoint: IJoint): boolean;
		update(): boolean;
		findJoint(sName: string): IJoint;
		findJointByName(sName: string): IJoint;
		attachMesh(pMesh: IMesh): boolean;
		detachMesh(): void;
	
	}
}
