// IUISlider export interface
// [write description here...]

/// <reference path="IUIComponent.ts" />

module akra {
export interface IUISlider extends IUIComponent {
	/** readonly */ pin: IUIComponent;
	value: float;
	range: float;
	text: string;

	signal updated(fValue: float): void;
}
}

#endif