#ifndef URI_TS
#define URI_TS

#include "IURI.ts"

module akra.util {
	export class URI implements IURI {
		private sScheme: string = null;
		private sUserinfo: string = null;
		private sHost: string = null;
		private nPort: uint = 0;
		private sPath: string = null;
		private sQuery: string = null;
		private sFragment: string = null;

		get urn(): string {
			return (this.sPath ? this.sPath : "") +
			(this.sQuery ? '?' + this.sQuery : "") +
			(this.sFragment ? '#' + this.sFragment : "");
		}

		get url(): string {
			return (this.sScheme ? this.sScheme : "") + this.authority;
		}

		get authority(): string {
			return (this.sHost ? '//' + (this.sUserinfo ? this.sUserinfo + '@' : "") +
				this.sHost + (this.nPort ? ':' + this.nPort : "") : "");
		}

		inline get scheme(): string {
			return this.sScheme;
		}

		get protocol(): string {
			if (!this.sScheme) {
				return this.sScheme;
			}

			return (this.sScheme.substr(0, this.sScheme.lastIndexOf(':')));
		}

		inline get userinfo(): string {
			return this.sUserinfo;
		}

		inline get host(): string {
			return this.sHost;
		}

		inline set host(sHost: string) {
			//TODO: check host format
			this.sHost = sHost;
		}

		inline get port(): uint {
			return this.nPort;
		}

		inline set port(iPort: uint) {
			this.nPort = iPort;
		}

		inline get path(): string {
			return this.sPath;
		}

		inline set path(sPath: string) {
			// debug_assert(!isNull(sPath.match(new RegExp("^(/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)$"))), 
			// 	"invalid path used: " + sPath);
			//TODO: check path format
			this.sPath = sPath;
		}

		inline get query(): string {
			//TODO: check query format
			return this.sQuery;
		}

		inline set query(sQuery: string) {
			this.sQuery = sQuery;
		}

		inline get fragment(): string {
			return this.sFragment;
		}


		constructor (pUri: URI);
		constructor (sUri: string);
		constructor (pUri?) {
			if (pUri) {
				this.set(pUri);
			}
		}

		set(pUri: URI);
		set(sUri: string);
		set(pData?): URI {
			if (isString(pData)) {
				var pUri:RegExpExecArray = URI.uriExp.exec(<string>pData);

				debug_assert(pUri !== null, 'Invalid URI format used.\nused uri: ' + pData);

				if (!pUri) {
					return null;
				}

				this.sScheme = pUri[1] || null;
				this.sUserinfo = pUri[2] || null;
				this.sHost = pUri[3] || null;
				this.nPort = parseInt(pUri[4]) || null;
				this.sPath = pUri[5] || pUri[6] || null;
				this.sQuery = pUri[7] || null;
				this.sFragment = pUri[8] || null;

				return this;
				
			}
			else if (pData instanceof URI) {
				return this.set(pData.toString());
			}
			
			debug_error('Unexpected data type was used.');

			return null;
		}

		toString(): string {
			return this.url + this.urn;
		}

		static here(): IURI {
			return new URI(document.location.href);
		}

		//------------------------------------------------------------------//
		//----- Validate a URI -----//
		//------------------------------------------------------------------//
		//- The different parts are kept in their own groups and can be recombined
		//  depending on the scheme:
		//  - http as $1://$3:$4$5?$7#$8
		//  - ftp as $1://$2@$3:$4$5
		//  - mailto as $1:$6?$7
		//- groups are as follows:
		//  1   == scheme
		//  2   == userinfo
		//  3   == host
		//  4   == port
		//  5,6 == path (5 if it has an authority, 6 if it doesn't)
		//  7   == query
		//  8   == fragment


		static private uriExp:RegExp = new RegExp("^([a-z0-9+.-]+:)?(?:\\/\\/(?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(?::(\\d*))?(\\/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?|(\\/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})*(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?)(?:\\?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?(?:#((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?$", "i");

		/*
		 composed as follows:
		 ^
		 ([a-z0-9+.-]+):							#scheme
		 (?:
		 //							#it has an authority:
		 (?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?	#userinfo
		 ((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)		#host
		 (?::(\d*))?						#port
		 (/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?	#path
		 |
		 #it doesn't have an authority:
		 (/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?	#path
		 )
		 (?:
		 \?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*)	#query string
		 )?
		 (?:
		 #((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*)	#fragment
		 )?
		 $
		 */
	}

	export var uri = (sUri:string): IURI => new util.URI(sUri);
}

#endif