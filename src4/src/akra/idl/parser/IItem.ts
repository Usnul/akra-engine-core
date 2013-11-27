﻿/// <reference path="../IMap.ts" />
/// <reference path="IState.ts" />
/// <reference path="IParser.ts" />

module akra.parser {
    export interface IItem {
        isEqual(pItem: IItem, eType?: EParserType): boolean;
        isParentItem(pItem: IItem): boolean;
        isChildItem(pItem: IItem): boolean;

        mark(): string;
        end(): string;
        nextMarked(): string;

        toString(): string;

        isExpected(sSymbol: string): boolean;
        addExpected(sSymbol: string): boolean;

        rule: IRule;
        position: uint;
        index: uint;
        state: IState;
        expectedSymbols: IMap<boolean>;
        isNewExpected: boolean;
        length: uint;
    }
}