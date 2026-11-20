!macro customInstall
  WriteRegStr HKCU "Software\Classes\tempo-ride" "" "URL:Tempo Ride"
  WriteRegStr HKCU "Software\Classes\tempo-ride" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\tempo-ride\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Classes\tempo-ride\shell\open\command" ""
  ${If} $0 == '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
    DeleteRegKey HKCU "Software\Classes\tempo-ride"
  ${EndIf}
!macroend
