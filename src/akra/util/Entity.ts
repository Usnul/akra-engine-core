/// <reference path="../idl/IEntity.ts" />
/// <reference path="../idl/IExplorerFunc.ts" />

/// <reference path="../logger.ts" />
/// <reference path="../debug.ts" />
/// <reference path="../bf/bf.ts" />
/// <reference path="../events.ts" />
/// <reference path="../config/config.ts" />
/// <reference path="../guid.ts" />

/// <reference path="ReferenceCounter.ts" />


module akra.util {

	enum EEntityStates {
		//обновился ли сам узел?
		k_Updated = 0x01,
		//есть ли среди потомков обновленные узлы
		k_DescendantsUpdtated = 0x02,
		//если ли обновленные узлы среди братьев или их потомках
		k_SiblingsUpdated = 0x04
	}

	export class Entity extends ReferenceCounter implements IEntity {
		guid: uint = guid();

		attached: ISignal<{ (pEntity: IEntity): void; }>;
		detached: ISignal<{ (pEntity: IEntity): void; }>;
		childAdded: ISignal<{ (pEntity: IEntity, pChild: IEntity): void; }>;
		childRemoved: ISignal<{ (pEntity: IEntity, pChild: IEntity): void; }>;

		protected _sName: string = null;
		protected _pParent: IEntity = null;
		protected _pSibling: IEntity = null;
		protected _pChild: IEntity = null;
		protected _eType: EEntityTypes = EEntityTypes.UNKNOWN;
		protected _iStateFlags: int = 0;

		getName(): string {
			return this._sName;
		}

		setName(sName: string) {
			this._sName = sName;
		}

		getParent(): IEntity {
			return this._pParent;
		}

		setParent(pParent: IEntity): void {
			this.attachToParent(pParent);
		}

		getSibling(): IEntity {
			return this._pSibling;
		}

		setSibling(pSibling: IEntity): void {
			this._pSibling = pSibling;
		}

		getChild(): IEntity {
			return this._pChild;
		}

		setChild(pChild: IEntity): void {
			this._pChild = pChild;
		}

		getType(): EEntityTypes {
			return this._eType;
		}
		
		getRightSibling(): IEntity {
			var pSibling: IEntity = this.getSibling();

			if (pSibling) {
				while (pSibling.getSibling()) {
					pSibling = pSibling.getSibling();
				}

				return pSibling;
			}

			return this;
		}

		getDepth(): int {
			var iDepth: int = -1;
			for (var pEntity: IEntity = this; pEntity; pEntity = pEntity.getParent(), ++iDepth) { };
			return iDepth;
		}

		constructor(eType: EEntityTypes) {
			super();
			this.setupSignals();

			this._eType = eType;
		}

		protected setupSignals(): void {
			this.attached = this.attached || new Signal(this);
			this.detached = this.detached || new Signal(this);
			this.childAdded = this.childAdded || new Signal(this);
			this.childRemoved = this.childRemoved || new Signal(this);
		}

		getRoot(): IEntity {
			for (var pEntity: IEntity = this, iDepth: int = -1; pEntity.getParent(); pEntity = pEntity.getParent(), ++iDepth) { };
			return pEntity;
		}

		destroy(bRecursive: boolean = false, bPromoteChildren: boolean = true): void {
			if (bRecursive) {
				if (this._pSibling) {
					this._pSibling.destroy(true);
				}

				if (this._pChild) {
					this._pChild.destroy(true);
				}
			}

			// destroy anything attached to this node
			//	destroySceneObject();
			// promote any children up to our parent
			if (bPromoteChildren && !bRecursive) {
				this.promoteChildren();
			}
			// now remove ourselves from our parent
			this.detachFromParent();
			// we should now be removed from the tree, and have no dependants
			debug.assert(this.referenceCount() == 0, "Attempting to delete a scene node which is still in use");
			debug.assert(this._pSibling == null, "Failure Destroying Node");
			debug.assert(this._pChild == null, "Failure Destroying Node");
		}

		findEntity(sName: string): IEntity {
			var pEntity: IEntity = null;

			if (this._sName === sName) {
				return this;
			}

			if (this._pSibling) {
				pEntity = this._pSibling.findEntity(sName);
			}

			if (pEntity == null && this._pChild) {
				pEntity = this._pChild.findEntity(sName);
			}

			return pEntity;
		}

		explore(fn: IExplorerFunc, bWithSiblings: boolean = false): void {

			if (fn(this) === false) {
				return;
			}

			if (this._pSibling && bWithSiblings) {
				this._pSibling.explore(fn, true);
			}

			if (this._pChild) {
				this._pChild.explore(fn, true);
			}
		}



		childOf(pParent: IEntity): boolean {
			for (var pEntity: IEntity = this; pEntity; pEntity = pEntity.getParent()) {
				if (pEntity.getParent() === pParent) {
					return true;
				}
			}

			return false;
		}

		children(): IEntity[] {
			var pChildren: IEntity[] = [];
			var pChild: IEntity = this.getChild();

			while (!isNull(pChild)) {
				pChildren.push(pChild);
				pChild = pChild.getSibling();
			}

			return pChildren;
		}

		childAt(i: int): IEntity {
			var pChild: IEntity = this.getChild();
			var n: int = 0;

			while (!isNull(pChild)) {
				if (n == i) {
					return pChild;
				}
				n++;
				pChild = pChild.getSibling();
			}

			return pChild;
		}

		/**
		 * Returns the current number of siblings of this object.
		 */
		siblingCount(): uint {
			var iCount: uint = 0;

			if (this._pParent) {
				var pNextSibling = this._pParent.getChild();
				if (pNextSibling) {
					while (pNextSibling) {
						pNextSibling = pNextSibling.getSibling();
						++iCount;
					}
				}
			}

			return iCount;
		}


		descCount(): uint {
			var n: uint = this.childCount();
			var pChild: IEntity = this.getChild();

			while (!isNull(pChild)) {
				n += pChild.descCount();
				pChild = pChild.getSibling();
			}

			return n;
		}

		/**
		 * Returns the current number of children of this object
		 */
		childCount(): uint {
			var iCount: uint = 0;
			var pChild: IEntity = this.getChild();

			while (!isNull(pChild)) {
				iCount++;
				pChild = pChild.getSibling();
			}

			// var pNextChild: IEntity = this.child;

			// if (pNextChild) {
			//	 ++ iCount;
			//	 while (pNextChild) {
			//		 pNextChild = pNextChild.sibling;
			//		 ++ iCount;
			//	 }
			// }
			return iCount;
		}

		isUpdated(): boolean {
			return bf.testAll(this._iStateFlags, EEntityStates.k_Updated);
		}

		hasUpdatedSubNodes(): boolean {
			return bf.testAll(this._iStateFlags, EEntityStates.k_DescendantsUpdtated);
		}

		recursiveUpdate(): boolean {
			// var bUpdated: boolean = false;
			// update myself
			if (this.update()) {
				this._iStateFlags = bf.setAll(this._iStateFlags, EEntityStates.k_Updated);
				// bUpdated = true;
			}
			// update my sibling
			if (this._pSibling && this._pSibling.recursiveUpdate()) {
				this._iStateFlags = bf.setAll(this._iStateFlags, EEntityStates.k_SiblingsUpdated);
				// bUpdated = true;
			}
			// update my child
			if (this._pChild && this._pChild.recursiveUpdate()) {
				this._iStateFlags = bf.setAll(this._iStateFlags, EEntityStates.k_DescendantsUpdtated);
				// bUpdated = true;
			}

			return (this._iStateFlags != 0);/*bUpdated */
		}

		recursivePreUpdate(): void {
			// clear the flags from the previous update
			this.prepareForUpdate();

			// update my sibling
			if (this._pSibling) {
				this._pSibling.recursivePreUpdate();
			}
			// update my child
			if (this._pChild) {
				this._pChild.recursivePreUpdate();
			}
		}


		prepareForUpdate(): void {
			this._iStateFlags = 0;
		}

		/** Parent is not undef */
		hasParent(): boolean {
			return isDefAndNotNull(this._pParent);
		}

		/** Child is not undef*/
		hasChild(): boolean {
			return isDefAndNotNull(this._pChild);
		}

		/** Sibling is not undef */
		hasSibling(): boolean {
			return isDefAndNotNull(this._pSibling);
		}

		/**
		 * Checks to see if the provided item is a sibling of this object
		 */
		isASibling(pSibling: IEntity): boolean {
			if (!pSibling) {
				return false;
			}
			// if the sibling we are looking for is me, or my FirstSibling, return true
			if (this == pSibling || this._pSibling == pSibling) {
				return true;
			}
			// if we have a sibling, continue searching
			if (this._pSibling) {
				return this._pSibling.isASibling(pSibling);
			}
			// it's not us, and we have no sibling to check. This is not a sibling of ours.
			return false;
		}

		/** Checks to see if the provided item is a child of this object. (one branch depth only) */
		isAChild(pChild: IEntity): boolean {
			if (!pChild) {
				return (false);
			}
			// if the sibling we are looking for is my FirstChild return true
			if (this._pChild == pChild) {
				return (true);
			}
			// if we have a child, continue searching
			if (this._pChild) {
				return (this._pChild.isASibling(pChild));
			}
			// it's not us, and we have no child to check. This is not a sibling of ours.
			return (false);
		}

		/**
		 * Checks to see if the provided item is a child or sibling of this object. If SearchEntireTree
		 * is TRUE, the check is done recursivly through all siblings and children. SearchEntireTree
		 * is FALSE by default.
		 */
		isInFamily(pEntity: IEntity, bSearchEntireTree?: boolean): boolean {
			if (!pEntity) {
				return (false);
			}
			// if the model we are looking for is me or my immediate family, return true
			if (this == pEntity || this._pChild == pEntity || this._pSibling == pEntity) {
				return (true);
			}
			// if not set to seach entire tree, just check my siblings and kids
			if (!bSearchEntireTree) {
				if (this.isASibling(pEntity)) {
					return (true);
				}
				if (this._pChild && this._pChild.isASibling(pEntity)) {
					return (true);
				}
			}
			// seach entire Tree!!!
			else {
				if (this._pSibling && this._pSibling.isInFamily(pEntity, bSearchEntireTree)) {
					return (true);
				}

				if (this._pChild && this._pChild.isInFamily(pEntity, bSearchEntireTree)) {
					return (true);
				}
			}

			return (false);
		}

		/**
		 * Adds the provided ModelSpace object to the descendant list of this object. The provided
		 * ModelSpace object is removed from any parent it may already belong to.
		 */
		addSibling(pSibling: IEntity): IEntity {
			if (pSibling) {
				// replace objects current sibling pointer with this new one
				pSibling.setSibling(this._pSibling);
				this.setSibling(pSibling);
			}

			return pSibling;
		}

		/**
		 * Adds the provided ModelSpace object to the descendant list of this object. The provided
		 * ModelSpace object is removed from any parent it may already belong to.
		 */
		addChild(pChild: IEntity): IEntity {
			if (pChild) {
				// Replace the new child's sibling pointer with our old first child.
				pChild.setSibling(this._pChild);
				// the new child becomes our first child pointer.
				this._pChild = pChild;
				this.childAdded.emit(pChild);
			}

			return pChild;
		}

		/**
		 * Removes a specified child object from this parent object. If the child is not the
		 * FirstChild of this object, all of the Children are searched to find the object to remove.
		 */
		removeChild(pChild: IEntity): IEntity {
			if (this._pChild && pChild) {
				if (this._pChild == pChild) {
					this._pChild = pChild.getSibling();
					pChild.setSibling(null);
				}
				else {
					var pTempNode: IEntity = this._pChild;
					// keep searching until we find the node who's sibling is our target
					// or we reach the end of the sibling chain
					while (pTempNode && (pTempNode.getSibling() != pChild)) {
						pTempNode = pTempNode.getSibling();
					}
					// if we found the proper item, set it's FirstSibling to be the FirstSibling of the child
					// we are removing
					if (pTempNode) {
						pTempNode.setSibling(pChild.getSibling());
						pChild.setSibling(null);
					}
				}

				this.childRemoved.emit(pChild);
			}

			return pChild;
		}

		/** Removes all Children from this parent object */
		removeAllChildren(): void {
			// keep removing children until end of chain is reached
			while (!isNull(this._pChild)) {
				var pNextSibling = this._pChild.getSibling();
				this._pChild.detachFromParent();
				this._pChild = pNextSibling;
			}
		}

		/** Attaches this object ot a new parent. Same as calling the parent's addChild() routine. */
		attachToParent(pParent: IEntity): boolean {

			var pParentPrev: IEntity = this.getParent();

			if (pParent != this._pParent) {

				this.detachFromParent();

				if (pParent) {
					if (pParent.addChild(this)) {
						this._pParent = pParent;
						this._pParent.addRef();
						this.attached.emit();
						return true;
					}

					return this.attachToParent(pParentPrev);
				}
			}

			var x: IEntity = null;

			return false;
		}

		detachFromParent(): boolean {
			// tell our current parent to release us
			if (this._pParent) {
				this._pParent.removeChild(this);
				//TODO: разобраться что за херня!!!!
				if (this._pParent) {
					this._pParent.release();
				}

				this._pParent = null;
				// my world matrix is now my local matrix
				this.detached.emit();
				return true;
			}

			return false;
		}

		/**
		 * Attaches this object's children to it's parent, promoting them up the tree
		 */
		promoteChildren(): void {
			// Do I have any children to promote?
			while (!isNull(this._pChild)) {
				var pNextSibling: IEntity = this._pChild.getSibling();
				this._pChild.attachToParent(this._pParent);
				this._pChild = pNextSibling;
			}
		}

		relocateChildren(pParent: IEntity): void {
			if (pParent != this) {
				// Do I have any children to relocate?
				while (!isNull(this._pChild)) {
					var pNextSibling: IEntity = this._pChild.getSibling();
					this._pChild.attachToParent(pParent);
					this._pChild = pNextSibling;
				}
			}
		}

		update(): boolean { return false; }

		toString(isRecursive: boolean = false, iDepth: int = 0): string {
			if (config.DEBUG) {
				if (!isRecursive) {
					return '<entity' + (this._sName ? ' ' + this._sName : "") + '>';
				}

				var pChild: IEntity = this.getChild();
				var s: string = "";

				for (var i = 0; i < iDepth; ++i) {
					s += ':  ';
				}

				s += '+----[depth: ' + this.getDepth() + ']' + this.toString() + '\n';

				if (pChild) {
					s += pChild.toString(true, iDepth + 1);
				}

				return s;

			}

			return null;

		}
	}
}