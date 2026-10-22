import { useState } from 'react'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { SearchIcon, PlusIcon, DeleteIcon, RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import type { RecipientInputProps } from '@renderer/types/SendRecipients'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { isValidDashAddress } from '@renderer/utils/address'
import { addressBookKey } from '@renderer/utils/addressBook'
import { matchingContacts } from '@renderer/utils/matchingContacts'
import { toast } from '@renderer/components/ui/Toast'
import { getErrorMessage } from '@renderer/utils/error'
import { ADDRESS_BOOK_COPY, RECIPIENT_BOOK_COPY } from '@renderer/constants/addressBook'
import { CONTACT_IDENTIFIER_CLASS, CONTACT_NAME_INPUT, FIELD_INVALID, RECIPIENT_FIELD_STYLES } from '@renderer/constants/addressField'
import { CHIP_ACTION, POPOVER_OPTION } from '@renderer/constants/surfaces'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DropdownField from '@renderer/components/ui/DropdownField'
import Spinner from '@renderer/components/ui/Spinner'

export default function RecipientInput({
  value,
  onChange,
  data,
  compact = false,
  appearance = 'default',
  ariaLabel,
  validate,
  invalid = false,
  valueAvatar = false,
  ownOptions,
  ownHeading = RECIPIENT_BOOK_COPY.ownAddresses,
  ownOptionsLoading = false,
  ownOptionsError = null,
  onRetryOwnOptions,
  ownedAddresses,
}: RecipientInputProps) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [menuKey, setMenuKey] = useState(0)

  const { contacts, loading: contactsLoading, err: contactsError, network, retry: retryContacts, addContact, deleteContact } = useAddressBook()
  const style = RECIPIENT_FIELD_STYLES[appearance]
  const isValid = validate ?? ((address: string) => isValidDashAddress(address, network))

  const trimmedValue = value.trim()
  const filteredContacts = matchingContacts(contacts, value, isValid)

  const isValidRecipient = isValid(trimmedValue)
  const invalidRecipient = invalid || (trimmedValue.length > 0 && !isValidRecipient)
  const alreadySaved = contacts.some((c) => addressBookKey(c.address) === addressBookKey(trimmedValue))
  const canSaveCurrent = isValidRecipient && !alreadySaved
  const hasOwnOptions = ownOptions != null && ownOptions.length > 0

  const resetAdding = (): void => {
    setAdding(false)
    setNewLabel('')
  }

  const handleSelectAddress = (address: string): void => {
    onChange(address)
    resetAdding()
    setMenuKey(key => key + 1)
  }

  const handleSaveContact = async (): Promise<void> => {
    const label = newLabel.trim()
    if (label.length === 0) {
      return
    }
    try {
      await addContact(label, trimmedValue)
      resetAdding()
    } catch (err) {
      toast.error(`**${RECIPIENT_BOOK_COPY.saveFailed}** ${getErrorMessage(err)}`)
    }
  }

  const handleDeleteContact = async (id: number): Promise<void> => {
    try {
      await deleteContact(id)
    } catch (err) {
      toast.error(`**${RECIPIENT_BOOK_COPY.removeFailed}** ${getErrorMessage(err)}`)
    }
  }

  let ownOptionsStatus: React.JSX.Element | undefined
  if (ownOptionsLoading || (ownOptionsError && onRetryOwnOptions)) {
    ownOptionsStatus = <span className="flex items-center gap-2">
      {ownOptionsLoading && <span role="status" aria-label="Loading recipient options"><Spinner size={12} className="dash-text-primary" /></span>}
      {!ownOptionsLoading && ownOptionsError && onRetryOwnOptions && <button type="button" onClick={onRetryOwnOptions} aria-label="Reload recipient options" title="Reload recipient options" className="dash-text-primary cursor-pointer hover:opacity-70">
        <RefreshIcon size={14} color="currentColor" />
      </button>}
    </span>
  }

  let bookStatus: React.JSX.Element | null = null
  if (filteredContacts.length === 0 && !contactsLoading && !adding) {
    bookStatus = contactsError != null ? (
      <div className={"flex items-center gap-2 px-[.625rem] py-2"}>
        <Text size={12} weight={"medium"} color={"red"}>{contactsError}</Text>
        <button type={"button"} onClick={retryContacts} className={CHIP_ACTION}>{RECIPIENT_BOOK_COPY.retry}</button>
      </div>
    ) : (
      <div className={"px-[.625rem] py-2"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          {contacts.length === 0 ? RECIPIENT_BOOK_COPY.empty : data.noResults}
        </Text>
      </div>
    )
  }

  return (
    <div className={"flex flex-col gap-2"}>
      {!compact && <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
        {data.label}
      </Text>}
      <DropdownField
        key={menuKey}
        editable
        highlightValue
        valueAvatar={valueAvatar}
        ariaLabel={ariaLabel ?? data.label}
        value={value}
        onChange={onChange}
        options={ownOptions ?? []}
        menuHeading={hasOwnOptions ? ownHeading : undefined}
        placeholder={data.placeholder}
        textSize={style.textSize}
        triggerClassName={`${style.field} ${invalidRecipient ? FIELD_INVALID : ''}`}
        inputInvalid={invalidRecipient}
        inputSuffix={ownOptionsStatus}
        toggleIcon={open => <SearchIcon size={style.searchIconSize} className={`dash-text-default transition-opacity ${open ? 'opacity-100' : 'opacity-40'}`} />}
        onOpenChange={open => { if (!open) resetAdding() }}
      >
        <div className={`flex flex-col ${hasOwnOptions ? 'mb-1.5 border-b border-dash-primary-dark-blue/8 pb-1.5 dark:border-white/8' : ''}`}>
          <div className={"flex items-center justify-between gap-2 px-[.625rem] pt-1.5 pb-2"}>
            <span className="flex items-center gap-2">
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                {data.addressBook}
              </Text>
              {contactsLoading && <span role="status" aria-label={RECIPIENT_BOOK_COPY.loading}><Spinner size={12} className="dash-text-primary" /></span>}
            </span>
            {canSaveCurrent && !adding && (
              <button
                type={"button"}
                onClick={() => setAdding(true)}
                className={`flex items-center gap-1 ${CHIP_ACTION}`}
              >
                <PlusIcon size={10} color={"currentColor"} />
                <span>{RECIPIENT_BOOK_COPY.saveCurrent}</span>
              </button>
            )}
          </div>

          {adding && (
            <div className={"flex items-center gap-2 px-[.625rem] pb-2"}>
              <input
                type={"text"}
                aria-label={RECIPIENT_BOOK_COPY.name}
                value={newLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSaveContact() }}
                placeholder={RECIPIENT_BOOK_COPY.name}
                autoFocus
                className={CONTACT_NAME_INPUT}
              />
              <Button type={"button"} onClick={handleSaveContact} disabled={newLabel.trim().length === 0} colorScheme={"primary"} size={"compact"}>
                {RECIPIENT_BOOK_COPY.save}
              </Button>
              <Button type={"button"} onClick={resetAdding} colorScheme={"primary-light"} size={"compact"}>
                {RECIPIENT_BOOK_COPY.cancel}
              </Button>
            </div>
          )}

          {filteredContacts.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 ${POPOVER_OPTION}`}
            >
              <button
                type={"button"}
                onClick={() => handleSelectAddress(entry.address)}
                className={"flex min-w-0 flex-1 flex-col gap-0.5 text-left cursor-pointer"}
              >
                <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>
                  {entry.address}
                </HighlightedIdentifier>
                <span className={"flex min-w-0 items-center gap-1.5"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"min-w-0 truncate"}>
                    {entry.label}
                  </Text>
                  {ownedAddresses?.has(addressBookKey(entry.address)) && (
                    <CustomBadge variant={"accent"} text={ADDRESS_BOOK_COPY.thisWallet} className={"shrink-0 whitespace-nowrap"} />
                  )}
                </span>
              </button>
              <button
                type={"button"}
                onClick={() => void handleDeleteContact(entry.id)}
                className={"shrink-0 flex items-center justify-center size-6 rounded-md hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5 cursor-pointer"}
                title={RECIPIENT_BOOK_COPY.remove}
              >
                <DeleteIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            </div>
          ))}
          {bookStatus}
        </div>
      </DropdownField>
    </div>
  )
}
