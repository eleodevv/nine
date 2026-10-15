// Aisla el proyecto Expo (Node) del modulo Go de la raiz: sin este
// archivo, `go build ./...` recorrería app/node_modules en busca de paquetes.
module nine/app

go 1.27
