

module akra {
	export interface IReferenceCounter {
		/**
		 * Текущее количесвто ссылок  на объект
		 **/
		referenceCount(): uint;
	
		/** Предупреждает если объект еще используется */
		destructor(): void;
	
	
		/**
		 * Добаволение ссылки  на объект, увеличивает внутренний счетчки на 1,
		 * проверяет не достигнуто ли максимальное количесвто
		 **/
		addRef(): uint;
	
		/**
		 * Уведомление об удалении ссылки  на объект, уменьшает внутренний счетчки на 1,
		 * проверяет есть ли ее объекты
		 **/
		release(): uint;
	
		
		 /** 
		 * Данная функция нужна чтобы обеспечить наследникам ее возможность,
		 * само количестdо ссылок не копируется
		 */
		eq(pSrc: IReferenceCounter): IReferenceCounter;
	}
	
}
