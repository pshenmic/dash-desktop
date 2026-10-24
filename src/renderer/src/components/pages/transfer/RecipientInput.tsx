import { useState } from 'react'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { SearchIcon, PlusIcon, DeleteIcon, RefreshIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import type { RecipientInputProps } from '@renderer/types/SendRecipients'
import { useAddressBook } from '@renderer/hooks/useAddressBook'
import { isValidDashAddress } from '@renderer/utils/address'
import { matchingContacts } from '@renderer/utils/matchingContacts'
import { toast } from '@renderer/components/ui/Toast'
import { getErrorMessage } from '@renderer/utils/error'
import { CONTACT_IDENTIFIER_CLASS, CONTACT_NAME_INPUT, FIELD_INVALID, RECIPIENT_FIELD_STYLES } from '@renderer/constants/addressField'
import { CHIP_ACTION, POPOVER_OPTION } from '@renderer/constants/surfaces'
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
  ownOptionsLoading = false,
  ownOptionsError = null,
  onRetryOwnOptions,
}: RecipientInputProps) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [menuKey, setMenuKey] = useState(0)

  const { contacts, loading: contactsLoading, network, addContact, deleteContact } = useAddressBook()
  const style = RECIPIENT_FIELD_STYLES[appearance]
  const isValid = validate ?? ((address: string) => isValidDashAddress(address, network))

  const trimmedValue = value.trim()
  const filteredContacts = matchingContacts(contacts, value, isValid)

  const isValidRecipient = isValid(trimmedValue)
  const invalidRecipient = invalid || (trimmedValue.length > 0 && !isValidRecipient)
  const alreadySaved = contacts.some((c) => c.address === trimmedValue)
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
      toast.error(`**Could not save contact** ${getErrorMessage(err)}`)
    }
  }

  const handleDeleteContact = async (id: number): Promise<void> => {
    try {
      await deleteContact(id)
    } catch (err) {
      toast.error(`**Could not remove contact** ${getErrorMessage(err)}`)
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
        menuHeading={hasOwnOptions ? 'Your addresses' : undefined}
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
              {contactsLoading && <span role="status" aria-label="Loading contacts"><Spinner size={12} className="dash-text-primary" /></span>}
            </span>
            {canSaveCurrent && !adding && (
              <button
                type={"button"}
                onClick={() => setAdding(true)}
                className={`flex items-center gap-1 ${CHIP_ACTION}`}
              >
                <PlusIcon size={10} color={"currentColor"} />
                <span>Save current</span>
              </button>
            )}
          </div>

          {adding && (
            <div className={"flex items-center gap-2 px-[.625rem] pb-2"}>
              <input
                type={"text"}
                aria-label={"Contact name"}
                value={newLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSaveContact() }}
                placeholder={"Contact name"}
                autoFocus
                className={CONTACT_NAME_INPUT}
              />
              <Button type={"button"} onClick={handleSaveContact} disabled={newLabel.trim().length === 0} colorScheme={"primary"} size={"compact"}>
                Save
              </Button>
              <Button type={"button"} onClick={resetAdding} colorScheme={"primary-light"} size={"compact"}>
                Cancel
              </Button>
            </div>
          )}

          {filteredContacts.length > 0 ? (
            filteredContacts.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 ${POPOVER_OPTION}`}
              >
                <button
                  type={"button"}
                  onClick={() => handleSelectAddress(entry.address)}
                  className={"flex min-w-0 flex-1 flex-col gap-0.5 text-left cursor-pointer"}
                >
                  <HighlightedIdentifier ellipsis className={CONTACT_IDENTIFIER_CLASS}>
                    {entry.address}
                  </HighlightedIdentifier>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                    {entry.label}
                  </Text>
                </button>
                <button
                  type={"button"}
                  onClick={() => void handleDeleteContact(entry.id)}
                  className={"shrink-0 flex items-center justify-center size-6 rounded-md hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5 cursor-pointer"}
                  title={"Remove contact"}
                >
                  <DeleteIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
                </button>
              </div>
            ))
          ) : !contactsLoading && !adding && (
            <div className={"px-[.625rem] py-2"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                {contacts.length === 0 ? 'No saved contacts yet' : data.noResults}
              </Text>
            </div>
          )}
        </div>
      </DropdownField>
    </div>
  )
}
