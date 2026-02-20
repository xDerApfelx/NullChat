!macro customHeader
  !define MUI_COMPONENTSPAGE_NODESC
!macroend

Section "Desktop Shortcut" SectionDesktop
  CreateShortCut "$DESKTOP\NullChat.lnk" "$INSTDIR\NullChat.exe"
SectionEnd

Section "Start Menu Shortcut" SectionStartMenu
  CreateShortCut "$SMPROGRAMS\NullChat.lnk" "$INSTDIR\NullChat.exe"
SectionEnd
