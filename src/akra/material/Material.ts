/// <reference path="../idl/IMaterial.ts" />
/// <reference path="../color/Color.ts" />
/// <reference path="../config/config.ts" />

module akra.material {
	import Color = color.Color;

	export class Material implements IMaterial {
		guid: uint = guid();
		name: string = null;

		diffuse: IColor = new Color;
		ambient: IColor = new Color;
		specular: IColor = new Color;
		emissive: IColor = new Color;
		transparency: float = 1.;
		shininess: float = 1.;

		private _pMatContainer: IMaterialConatiner = {
			"DIFFUSE": new math.Vec4(),
			"AMBIENT": new math.Vec4(),
			"SPECULAR": new math.Vec4(),
			"EMISSIVE": new math.Vec4(),
			"SHININESS": 1.,
			"TRANSPARENCY": 1.
		};

		constructor(
			sName: string = null,
			pMat: IMaterialBase = null) {

			this.name = sName;
			this.set(pMat);
		}

		set(pMat: IMaterialBase): IMaterial;
		set(sMat: string): IMaterial;
		set(mat): IMaterial {
			if (!isNull(mat)) {
				if (isString(arguments[0])) {
					switch (arguments[0]) {
						case "gold":
							this.specular.set(1.00, 0.71, 0.29);
							this.diffuse.set(1.00, 0.86, 0.57);
							this.diffuse.set(1.00, 0.86, 0.57).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "copper":
							this.specular.set(0.95, 0.64, 0.54);
							this.diffuse.set(0.98, 0.82, 0.76);
							this.diffuse.set(0.98, 0.82, 0.76).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "plastic":
							this.specular.set(0.03);
							this.diffuse.set(0.21);
							this.diffuse.set(0.21).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "iron":
							this.specular.set(0.56, 0.57, 0.58);
							this.diffuse.set(0.77, 0.78, 0.78);
							this.diffuse.set(0.77, 0.78, 0.78).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "aluminium":
							this.specular.set(0.91, 0.92, 0.92);
							this.diffuse.set(0.96, 0.96, 0.97);
							this.diffuse.set(0.96, 0.96, 0.97).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "silver": 
							this.specular.set(0.95, 0.93, 0.88);
							this.diffuse.set(0.98, 0.97, 0.95);
							this.diffuse.set(0.98, 0.97, 0.95).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "water":
							this.specular.set(0.02);
							this.diffuse.set(0.15);
							this.diffuse.set(0.15).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "glass":
							this.specular.set(0.08);
							this.diffuse.set(0.31);
							this.diffuse.set(0.31).multiply( (math.Vec3.temp(this.specular.r,this.specular.g,this.specular.b).subtract(math.Vec3.temp(1.)).length() / 1.733) );
							break;
						case "black":
							this.specular.set(0.0);
							this.diffuse.set(0.0);
							break;
						default:
							logger.error("unknown material: " + arguments[0]);
					}
				}
				else {
					this.diffuse.set(mat.diffuse);
					this.ambient.set(mat.ambient);
					this.specular.set(mat.specular);
					this.emissive.set(mat.emissive);
					this.shininess = mat.shininess;
					this.transparency = mat.transparency;
				}
			}

			return this;
		}

		isEqual(pMat: IMaterialBase): boolean {
			return Color.isEqual(this.diffuse, pMat.diffuse) &&
				Color.isEqual(this.ambient, pMat.ambient) &&
				Color.isEqual(this.specular, pMat.specular) &&
				Color.isEqual(this.emissive, pMat.emissive) &&
				this.shininess === pMat.shininess &&
				this.transparency === pMat.transparency;
		}

		isTransparent(): boolean {
			return this.transparency < 1.;
		}

		toString(): string {
			if (config.DEBUG) {
				var s = "\nMATERIAL - " + this.name + "\n";

				s += "------------------------------------\n";
				s += "diffuse:      " + this.diffuse.toString() + "\n";
				s += "ambient:      " + this.ambient.toString() + "\n";
				s += "specular:     " + this.ambient.toString() + "\n";
				s += "emissive:     " + this.emissive.toString() + "\n";
				s += "shininess:    " + this.shininess + "\n";
				s += "transparency: " + this.transparency + "\n";

				return s;
			}

			return null;
		}

		_getMatContainer(): IMaterialConatiner {
			return this._pMatContainer;
		}
	}

}