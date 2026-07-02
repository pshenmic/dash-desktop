# ТЗ: Поддержка shielded-транзакций в Wallet UI

> Документ для реализации в проекте Wallet с помощью Claude Code.
> Основан на API `dash-platform-sdk` версии `v1.5.0-dev.1` (ветка `feat/add-shielded`, PR #84).
> Продукт: **web/desktop кошелёк**. Уровень раскрытия криптографии: **опционально в «advanced details»**.

---

## 0. Контекст и цель

Shielded-транзакции — это приватные транзакции на базе **Orchard** (схема из Zcash: Halo 2 zk-SNARK-и, note commitment tree, nullifier-ы). Средства переносятся из «прозрачного» вида в **экранированный пул** (shielded pool), где связь вход→выход скрыта криптографически, а валидность подтверждается zero-knowledge доказательством.

Цель — добавить в кошелёк:
1. Отдельный **приватный (shielded) баланс** рядом с прозрачным.
2. Пополнение пула (**deposit / shield**).
3. Приватные переводы и выводы из пула (**spend**).
4. Историю входящих shielded-транзакций через viewing key (read-only).

### Ментальная модель для пользователя
Пользователь **не видит** ноты, nullifier-ы, anchor-ы напрямую — это внутренняя криптография. Вместо этого — привычная модель «**прозрачный баланс ↔ приватный баланс**» и три действия: **Shield** (пополнить пул), **Send** (приватно отправить), **Withdraw/Unshield** (вывести из пула). Внутренности доступны только в раскрывающемся блоке «Advanced details».

---

## 1. Ключевые понятия (глоссарий)

| Термин | Что это | Показываем юзеру? |
|---|---|---|
| **Note** | «Монета» в пуле. On-chain хранится только зашифрованный вид. | Нет (кол-во — в advanced) |
| **Nullifier** | Уникальный маркер траты ноты. Публикуется при spend, защита от double-spend, но не раскрывает какую ноту потратили. | Только в advanced |
| **cmx** (note commitment) | Криптографическое обязательство по ноте — лист в дереве. | Нет |
| **cvNet** (value commitment) | Обязательство по сумме (сумма скрыта). | Нет |
| **Anchor** | Корень note commitment tree (Merkle-дерева всех нот). Spend доказывает «моя нота есть в дереве с этим корнем». | Только в advanced |
| **Viewing key** | Read-only ключ, деривится из seed по ZIP-32 (`m/32'/coinType'/account'`). Находит свои ноты без права тратить. | Экспорт в настройках |
| **Spendable note** | Восстановленная нота + Merkle-путь (witness) против anchor-а. Нужна для любого spend. | Нет |
| **coinType** | SLIP-44: `5` = mainnet, `1` = testnet. Выводится из сети. | Нет |

---

## 2. API SDK (единственный источник истины)

Весь доступ идёт через `sdk.shielded` (`ShieldedController`). Инстанс SDK: `new DashPlatformSDK({ network })`.

### 2.1. Read-only запросы к пулу

```ts
// Общий баланс всего пула (не персональный!). Для инфо/статистики.
sdk.shielded.getShieldedPoolState(): Promise<bigint | undefined>

// Кол-во листьев (нот) в дереве. Знаменатель для прогресса синка.
sdk.shielded.getShieldedNotesCount(): Promise<bigint | undefined>

// Батч зашифрованных нот из пула, начиная с индекса.
sdk.shielded.getShieldedEncryptedNotes(startIndex: bigint, count: number): Promise<ShieldedEncryptedNote[]>

// Валидные anchor-ы (корни дерева), принимаемые пулом.
sdk.shielded.getShieldedAnchors(): Promise<Uint8Array[]>
sdk.shielded.getMostRecentShieldedAnchor(): Promise<Uint8Array | undefined>

// Проверка, потрачены ли нуллификаторы.
sdk.shielded.getShieldedNullifiers(nullifiers: Uint8Array[]): Promise<ShieldedNullifierStatus[]>
```

### 2.2. Восстановление и подготовка своих нот (клиентская крипта, синхронно)

```ts
// Перебором дешифрует ноты viewing-key-ом из seed; возвращает только адресованные тебе,
// каждую с глобальной позицией `index` в дереве. account — ZIP-32 account index.
// coinType вычисляется внутри из network.
sdk.shielded.recoverNotes(notes: ShieldedEncryptedNote[], seed: Uint8Array, account: number): RecoveredNoteWASM[]

// Пересобирает дерево из ПОЛНОГО набора нот, витнессит те, что тратим.
// notes = полный on-chain набор (листья), recovered = что хотим потратить.
// Возвращает готовые spends + общий anchor.
sdk.shielded.buildSpendableNotes(
  notes: ShieldedEncryptedNote[],
  recovered: RecoveredNoteWASM[]
): { spends: SpendableNoteWASM[], anchor: Uint8Array }
```

### 2.3. Сборка транзакции

```ts
sdk.shielded.createStateTransition<K extends ShieldedTransitionType>(
  type: K,
  params: ShieldedTransitionParamsMap[K]
): StateTransitionWASM
```
Возвращает готовый `StateTransitionWASM`, который отправляется в сеть штатным механизмом кошелька (broadcast state transition — как для остальных транзакций Platform).

### 2.4. Прогрев builder-а (ВАЖНО для UX)

```ts
// Лениво создаёт и кеширует ShieldedBuilderWASM. Построение Halo 2 proving key
// занимает несколько секунд (медленнее на слабом железе). Вызвать ЗАРАНЕЕ.
sdk.shielded.init(builder?: ShieldedBuilderWASM): ShieldedBuilderWASM
```

---

## 3. Типы (из `types.ts` SDK)

```ts
export interface ShieldedEncryptedNote {
  nullifier: Uint8Array
  cmx: Uint8Array
  encryptedNote: Uint8Array
  cvNet: Uint8Array
}

export interface ShieldedNullifierStatus {
  nullifier: Uint8Array
  isSpent: boolean
}

export interface ShieldedTransitionBaseParams {
  platformVersion?: PlatformVersionWASM   // по умолчанию — последняя
}

// Общие поля всех spend-транзакций:
export interface ShieldedSpendParams extends ShieldedTransitionBaseParams {
  spends: SpendableNoteWASM[]
  changeAddress: OrchardAddressWASM       // авто: свой shielded-адрес
  seed: Uint8Array
  coinType: number
  account: number
  anchor: Uint8Array
  memo?: string                           // UTF-8, по умолчанию пустой
}
```

### 3.1. Deposit-типы

```ts
// shield: прозрачные platform-адреса -> пул
export interface ShieldParams extends ShieldedTransitionBaseParams {
  recipient: OrchardAddressWASM
  shieldAmount: bigint
  inputs: InputAddressWASM[]
  privateKeys: PrivateKeyWASM[]
  feeStrategy: AddressFundsFeeStrategyStepWASM[]
  userFeeIncrease: number
  memo?: string
  senderOvk?: Uint8Array
}

// shieldFromAssetLock: asset lock -> пул
export interface ShieldFromAssetLockParams extends ShieldedTransitionBaseParams {
  recipient: OrchardAddressWASM
  shieldAmount: bigint
  assetLockProof: AssetLockProofWASM
  privateKey: PrivateKeyWASM
  memo?: string
  dummyOutputs: number
  senderOvk?: Uint8Array
  surplusOutput?: PlatformAddressLike
}
```

### 3.2. Spend-типы

```ts
// shieldedTransfer: пул -> пул (приватный перевод)
export interface ShieldedTransferParams extends ShieldedSpendParams {
  recipient: OrchardAddressWASM
  transferAmount: bigint
}

// unshield: пул -> баланс platform-identity
export interface UnshieldParams extends ShieldedSpendParams {
  outputAddress: PlatformAddressLike
  unshieldAmount: bigint
}

// shieldedWithdrawal: пул -> Core L1 (ПРИВАТНОСТЬ ВЫХОДА ТЕРЯЕТСЯ)
export interface ShieldedWithdrawalParams extends ShieldedSpendParams {
  withdrawalAmount: bigint
  outputScript: CoreScriptWASM
  coreFeePerByte: number
  pooling: PoolingLike               // напр. 'Standard'
}

// identityCreateFromShieldedPool: пул -> новая identity
export interface IdentityCreateFromShieldedPoolParams extends ShieldedSpendParams {
  publicKeys: IdentityPublicKeyInCreation[]
  privateKeys: PrivateKeyWASM[]
  denomination: bigint
  sendToAddressOnCreationFailure: PlatformAddressLike
}
```

### 3.3. Карта тип → действие в UI

| SDK type | Направление | Категория | Действие в UI |
|---|---|---|---|
| `shield` | transparent → пул | deposit | **Shield** |
| `shieldFromAssetLock` | asset lock → пул | deposit | **Shield** (из asset lock) |
| `shieldedTransfer` | пул → пул | spend | **Send (private)** |
| `unshield` | пул → identity balance | spend | **Unshield** |
| `shieldedWithdrawal` | пул → Core L1 | spend | **Withdraw to L1** ⚠ |
| `identityCreateFromShieldedPool` | пул → новая identity | spend | **Create identity** |

---

## 4. Схема работы (spend flow)

Любая трата из пула — это **многошаговый процесс**, а не мгновенная отправка:

```
1. SYNC:   getShieldedEncryptedNotes(0n, count)   // скачать весь набор нот (батчами)
              ↓
           recoverNotes(notes, seed, account)      // найти свои ноты (viewing key)
              ↓
           buildSpendableNotes(notes, recovered)   // → { spends, anchor }
2. PROVE:  createStateTransition(type, params)      // генерация zk-доказательства (секунды)
3. BROADCAST: отправка StateTransitionWASM в сеть   // штатный механизм кошелька
```

**Deposit (shield)** проще — нет фазы SYNC, сразу `createStateTransition('shield'|'shieldFromAssetLock', ...)` → broadcast.

### Три фазы в UI (обязательно раздельно)
```
● Syncing notes …………  ██████░░  8.2k / 12.9k    (знаменатель = getShieldedNotesCount)
○ Generating zero-knowledge proof                  (некансельабельно после старта)
○ Broadcasting
```
Не схлопывать в один «Sending…» — синк может идти десятки секунд и без разбивки читается как зависание.

---

## 5. Архитектурные требования

1. **Сервисный слой.** Вся работа с `sdk.shielded` — в отдельном модуле/сервисе (`ShieldedService` или аналог по конвенциям Wallet), UI-компоненты не дёргают SDK напрямую.
2. **Прогрев proving key.** Вызвать `sdk.shielded.init()` заранее (при входе в раздел кошелька / в фоне после логина), не на клике «Send». Кешируется на сессию.
3. **Модель баланса.** Приватный баланс считается на клиенте из восстановленных нот (`recoverNotes`) минус потраченные (проверка через `getShieldedNullifiers`). `getShieldedPoolState` — это баланс ВСЕГО пула, НЕ персональный; использовать только для инфо/статистики.
4. **Кеш нот.** Скачанный набор нот и результат `recoverNotes` кешировать, чтобы не пересинхронизировать на каждое действие. Инвалидация — по росту `getShieldedNotesCount`.
5. **seed / приватные ключи.** Никогда не покидают клиент. Работа с seed — по существующим конвенциям безопасности Wallet.
6. **Change address.** Всегда авто (свой `OrchardAddressWASM`), НЕ поле для пользователя.
7. **bigint.** Все суммы — `bigint` (duffs/лимбы). Конверсия в отображаемый DASH — на границе UI.
8. **Адаптация к стеку.** Реализацию UI-компонентов делать в стиле существующего кодовой базы Wallet (тот же фреймворк, стейт-менеджмент, дизайн-система). Claude Code должен сначала изучить существующие экраны отправки/баланса и следовать им.

---

## 6. Поэтапный план реализации

> **Правило:** каждый этап завершается проверкой (см. «Критерии приёмки»). Переходить к следующему только после подтверждения, что предыдущий работает.

### Этап 0 — Основа (инфраструктура, без UI-фич)
**Что делаем:**
- Подключить `dash-platform-sdk` `v1.5.0-dev.1` (или новее), убедиться, что `sdk.shielded` доступен.
- Создать сервисный слой `ShieldedService` — тонкая обёртка над `sdk.shielded` со всеми методами из раздела 2.
- Реализовать прогрев builder-а: вызов `init()` с индикатором состояния «Preparing private transactions…» / «ready».
- Ввести типы приватного баланса и статусов синка в стейт кошелька.
- Заглушки экранов (пустой раздел «Shielded» с местом под баланс).

**Критерии приёмки:**
- SDK инициализируется, `init()` отрабатывает, состояние «ready» отражается в UI.
- `getShieldedPoolState()` и `getShieldedNotesCount()` возвращают `bigint` (проверка на testnet).
- Никаких ошибок в консоли, раздел открывается.

---

### Этап 1 — Базовые read-only функции (простые, без трат)
**Что делаем:**
- **Отображение баланса:** блок с прозрачным и приватным (🛡) балансом. На этом этапе приватный можно показывать из восстановленных нот.
- **Синхронизация нот:** `getShieldedEncryptedNotes` (батчами) → `recoverNotes(notes, seed, account)`. Прогресс синка с знаменателем из `getShieldedNotesCount`.
- **Персональный баланс:** сумма восстановленных нот минус потраченные (`getShieldedNullifiers`).
- **История входящих:** список восстановленных нот как «полученные приватные транзакции» (сумма, memo).
- **Настройки → Privacy → Export viewing key** (read-only обзор без права тратить).

**Критерии приёмки:**
- Синк проходит, прогресс-бар двигается, знаменатель корректный.
- Для тестового seed с известными нотами приватный баланс совпадает с ожидаемым.
- Экспорт viewing key работает.
- Все действия — только чтение, ничего не отправляется.

---

### Этап 2 — Deposit (Shield), простой spend без SYNC
**Что делаем:**
- Экран **Shield**: `[From] Transparent` → `[Amount]` → `[Memo (🔒 encrypted)]` → `[Shield]`.
- Реализовать `createStateTransition('shield', ShieldParams)` + broadcast.
- Опционально: `shieldFromAssetLock` (deposit из asset lock) как отдельный источник в той же форме.
- Фаза proof + broadcast (у deposit нет фазы SYNC).
- Блок «Advanced details» (свёрнут): anchor, est. proof time.

**Критерии приёмки:**
- На testnet: shield прозрачных средств проходит, транзакция принимается сетью.
- После deposit приватный баланс растёт (после ре-синка нот).
- Форма валидирует сумму ≤ доступного прозрачного баланса.

---

### Этап 3 — Базовые spend-транзакции (полный 3-фазный flow)
**Что делаем:**
- Экран **Send (private)** → `shieldedTransfer` (пул → пул).
- Экран **Unshield** → `unshield` (пул → identity balance).
- Полный flow: SYNC (`buildSpendableNotes`) → PROVE (`createStateTransition`) → BROADCAST, с тремя раздельными фазами прогресса.
- Фаза PROVE — некансельабельна (убрать Cancel после старта).
- `changeAddress` — авто (свой Orchard-адрес).
- «Advanced details»: anchor, кол-во потраченных нот, change note.

**Критерии приёмки:**
- На testnet: `shieldedTransfer` и `unshield` проходят, приняты сетью.
- Три фазы отображаются раздельно, прогресс синка корректный.
- Приватный баланс уменьшается на сумму + комиссию после операции.
- Нельзя потратить больше доступного; двойная трата предотвращена (проверка nullifier).

---

### Этап 4 — Остальные spend-транзакции (сложные, с предупреждениями)
**Что делаем:**
- Экран **Withdraw to L1** → `shieldedWithdrawal` (`outputScript`, `coreFeePerByte`, `pooling`).
  - **Обязательное предупреждение:** «The receiving Core address and amount will be publicly visible on-chain once withdrawn.»
- Экран **Create identity from pool** → `identityCreateFromShieldedPool` (добавление public keys, `denomination`, `sendToAddressOnCreationFailure`).
  - Фаза PROVE здесь самая долгая (есть `bindingsSignature`) — показать оценку времени.
- Полировка: анимации фаз, обработка ошибок witness/proof, ретраи синка.

**Критерии приёмки:**
- На testnet: `shieldedWithdrawal` проходит, средства приходят на Core L1.
- Предупреждение о раскрытии выхода показывается перед подтверждением.
- `identityCreateFromShieldedPool` формирует валидную транзакцию (на реальных нотах; синтетические ноты отклоняются на этапе `identityId` — покрывать против живого пула).

---

## 7. UX-детали и предупреждения

- **Memo** (`params.memo`, UTF-8) — показать поле, пометить «🔒 encrypted, only recipient reads». Не публичное, но получателю видно. По умолчанию — пустой.
- **Withdrawal раскрывает выход** — единственный тип, где приватность на стороне выхода теряется (идёт на Core L1). Явный warning обязателен.
- **Change address** — автоматически свой адрес, не показывать как поле ввода.
- **Долгий proof** — состояние «Generating zero-knowledge proof…» отдельным шагом; для `identityCreateFromShieldedPool` — с оценкой времени.
- **Прогрев builder-а** — если пользователь жмёт Send до готовности, кнопка в состоянии «Preparing…», а не ошибка.
- **Advanced details** — свёрнуты по умолчанию; внутри: anchor, кол-во нот, nullifier-ы, est. proof size/time.

---

## 8. Мокап главного экрана (ориентир)

```
┌───────────────────────────────────────────────────────┐
│  Wallet                                    ⟳ synced 2m  │
│                                                         │
│  Transparent        1.4200 DASH        [ Shield ]        │
│  🛡 Shielded         0.8000 DASH        [ Send ] [ ▾ ]    │
│                                                         │
│  ▾ раскрывает: Send · Withdraw to L1 · Create identity  │
└───────────────────────────────────────────────────────┘
```

Форма spend + прогресс:
```
┌─ Send privately ──────────────────────────────────────┐
│  To      [ orchard address …………………………………… ]           │
│  Amount  [ 0.25 ] DASH        available 0.8000          │
│  Memo    [ ………………… ]  🔒 encrypted, only recipient reads │
│  ▸ Advanced details                                     │
│                                        [ Cancel ][ Send ]│
└─────────────────────────────────────────────────────────┘
  ● Syncing notes ………  ██████░░  8.2k / 12.9k
  ○ Generating zero-knowledge proof
  ○ Broadcasting
```

---

## 9. Пример кода (референс из тестов SDK)

```ts
// Полный shieldedTransfer: от восстановления нот до готовой транзакции
const notes     = await sdk.shielded.getShieldedEncryptedNotes(0n, count)   // весь набор
const recovered = sdk.shielded.recoverNotes(notes, seed, account)           // свои ноты
const { spends, anchor } = sdk.shielded.buildSpendableNotes(notes, recovered)

const stateTransition = sdk.shielded.createStateTransition('shieldedTransfer', {
  spends,
  recipient: recipientOrchardAddress,   // OrchardAddressWASM
  transferAmount: 1_000_000n,
  changeAddress: myOrchardAddress,      // авто, свой адрес
  seed,
  coinType,                             // 5 = mainnet, 1 = testnet
  account,
  anchor,
  memo: 'optional utf-8 memo'           // можно опустить
})

// далее — broadcast stateTransition штатным механизмом кошелька
```

---

## 10. Открытые вопросы (уточнить в проекте Wallet)

1. Как в Wallet сейчас хранится/выдаётся `seed` — использовать существующий механизм.
2. Как формируется `OrchardAddressWASM` получателя из вводимой строки адреса (формат shielded-адреса).
3. Штатный путь broadcast для `StateTransitionWASM` в этом кошельке.
4. Дизайн-система/компоненты для форм, прогресс-баров, warning-блоков.
5. Точная версия SDK для установки (`v1.5.0-dev.1` или актуальнее к моменту старта).
