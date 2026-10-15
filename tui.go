package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	osc52 "github.com/aymanbagabas/go-osc52/v2"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	qrcode "github.com/skip2/go-qrcode"
)

const puertoServidor = 9009

// ---------- paleta ----------

var (
	colFondo       = lipgloss.Color("#000000")
	colSuperficie  = lipgloss.Color("#121212")
	colSuperficie2 = lipgloss.Color("#1e1e1d")
	colTexto       = lipgloss.Color("#faf9f6")
	colTexto2      = lipgloss.Color("#a0a0a0")
	colBorde       = lipgloss.Color("#333333")
	colAcento      = lipgloss.Color("#cbb0f7")
	colAcentoSuave = lipgloss.Color("#8f76c9")

	colOk       = lipgloss.Color("#7bd88f")
	colAviso    = lipgloss.Color("#e2b93b")
	colError    = lipgloss.Color("#f2748a")
	colInactivo = lipgloss.Color("#6b6b6b")
)

// ---------- estilos ----------

var (
	estiloFondo = lipgloss.NewStyle().Background(colFondo).Foreground(colTexto)

	estiloCabecera   = lipgloss.NewStyle().Background(colSuperficie)
	estiloBarra      = lipgloss.NewStyle().Background(colSuperficie)
	estiloMarca      = lipgloss.NewStyle().Bold(true).Foreground(colAcento)
	estiloMarcaTenue = lipgloss.NewStyle().Foreground(colTexto2)
	estiloTexto      = lipgloss.NewStyle().Foreground(colTexto)
	estiloTexto2     = lipgloss.NewStyle().Foreground(colTexto2)
	estiloTitulo     = lipgloss.NewStyle().Bold(true).Foreground(colTexto)
	estiloLogo       = lipgloss.NewStyle().Foreground(colAcentoSuave)
	estiloDesc       = lipgloss.NewStyle().Foreground(colTexto2).Italic(true)

	estiloOk       = lipgloss.NewStyle().Foreground(colOk)
	estiloAviso    = lipgloss.NewStyle().Foreground(colAviso)
	estiloError    = lipgloss.NewStyle().Foreground(colError)
	estiloInactivo = lipgloss.NewStyle().Foreground(colInactivo)

	estiloTecla = lipgloss.NewStyle().Bold(true).Foreground(colAcento)

	estiloMenuActivo = lipgloss.NewStyle().Bold(true).Foreground(colAcento)
	estiloMenu       = lipgloss.NewStyle().Foreground(colTexto2)
	estiloCodigo     = lipgloss.NewStyle().Bold(true).Foreground(colAcento)

	estiloFilaSeleccion = lipgloss.NewStyle().
				Background(colAcento).
				Foreground(colFondo)

	// El QR va negro sobre blanco para que la cámara lo lea sin importar
	// el tema de tu terminal. go-qrcode ya incluye la zona de silencio.
	estiloQR = lipgloss.NewStyle().
			Foreground(lipgloss.Color("0")).
			Background(lipgloss.Color("15"))
)

const logo = `       _
  _ __ (_)_ __   ___
 | '_ \| | '_ \ / _ \
 | | | | | | | |  __/
 |_| |_|_|_| |_|\___|`

// ---------- navegación ----------

type vista int

const (
	vistaInicio vista = iota
	vistaEmparejar
	vistaPuertos
)

const (
	opcionEmparejar = iota
	opcionPuertos
)

var etiquetasMenu = []string{"Generar código y QR", "Administrar puertos"}

type tipoAviso int

const (
	avisoInfo tipoAviso = iota
	avisoOk
	avisoError
)

// ---------- modelo ----------

type modelo struct {
	gestor      *Gestor
	ip          string
	ancho, alto int

	vista  vista
	opcion int

	// emparejamiento
	sesion         *Sesion
	qr             string
	recienGenerado bool

	// puertos
	puertos   []Puerto
	cargando  bool
	seleccion int
	confirmar bool

	// mensajes
	aviso     string
	tipoAviso tipoAviso

	dispositivos int
	frame        int
}

// ---------- mensajes ----------

type tickMsg time.Time
type spinnerMsg struct{}
type emparejadoMsg struct{}
type sesionCerradaMsg struct{}
type puertosMsg []Puerto
type errorPuertosMsg struct{ err error }
type matarMsg struct {
	puerto int
	err    error
}
type avisoMsg struct {
	texto string
	tipo  tipoAviso
}

var framesSpinner = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

func tick() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg { return tickMsg(t) })
}

func tickSpinner() tea.Cmd {
	return tea.Tick(90*time.Millisecond, func(time.Time) tea.Msg { return spinnerMsg{} })
}

func cargarPuertosCmd() tea.Cmd {
	return func() tea.Msg {
		lista, err := Listar()
		if err != nil {
			return errorPuertosMsg{err}
		}
		return puertosMsg(lista)
	}
}

func matarCmd(p Puerto) tea.Cmd {
	return func() tea.Msg {
		return matarMsg{puerto: p.Puerto, err: Matar(p.Puerto)}
	}
}

func copiarCmd(texto string) tea.Cmd {
	return func() tea.Msg {
		if _, err := osc52.New(texto).WriteTo(os.Stdout); err != nil {
			return avisoMsg{"no se pudo copiar al portapapeles", avisoError}
		}
		return avisoMsg{"código copiado al portapapeles", avisoOk}
	}
}

// ---------- ciclo de vida ----------

// Init se ejecuta una vez al arrancar.
func (m *modelo) Init() tea.Cmd {
	return tea.Batch(tick(), tickSpinner(), cargarPuertosCmd())
}

// Update recibe cada evento (tecla, tick, ratón, emparejado...) y cambia el estado.
func (m *modelo) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.ancho, m.alto = msg.Width, msg.Height

	case tea.KeyMsg:
		if cmd, ok := m.tecla(msg.String()); ok {
			return m, cmd
		}

	case tea.MouseMsg:
		if cmd, ok := m.raton(msg); ok {
			return m, cmd
		}

	case tickMsg:
		if m.vista == vistaEmparejar && m.sesion != nil && time.Now().After(m.sesion.ExpiraEn) {
			m.vista = vistaInicio
			m.sesion = nil
			m.aviso = "el código expiró, genera otro"
			m.tipoAviso = avisoInfo
		}
		return m, tick()

	case spinnerMsg:
		if m.cargando {
			m.frame = (m.frame + 1) % len(framesSpinner)
			return m, tickSpinner()
		}
		return m, nil

	case emparejadoMsg:
		m.dispositivos++
		m.vista = vistaInicio
		m.sesion = nil
		m.aviso = "dispositivo emparejado"
		m.tipoAviso = avisoOk

	case sesionCerradaMsg:
		// CerrarSesiones se dispara al generar un código nuevo; no debemos
		// cerrar la vista de emparejamiento que acabamos de abrir.
		if m.recienGenerado {
			m.recienGenerado = false
			return m, nil
		}
		m.vista = vistaInicio
		m.sesion = nil
		m.aviso = "código nuevo: los dispositivos se desconectaron"
		m.tipoAviso = avisoInfo

	case puertosMsg:
		m.puertos = msg
		m.cargando = false
		if m.seleccion >= len(m.puertos) {
			m.seleccion = max(0, len(m.puertos)-1)
		}

	case errorPuertosMsg:
		m.cargando = false
		m.aviso = "no se pudieron leer los puertos: " + msg.err.Error()
		m.tipoAviso = avisoError

	case matarMsg:
		m.confirmar = false
		if msg.err != nil {
			m.aviso = "error: " + msg.err.Error()
			m.tipoAviso = avisoError
		} else {
			m.aviso = fmt.Sprintf("puerto %d terminado", msg.puerto)
			m.tipoAviso = avisoOk
		}
		return m, m.cargar()

	case avisoMsg:
		m.aviso = msg.texto
		m.tipoAviso = msg.tipo
	}

	return m, nil
}

// tecla procesa las teclas y devuelve si el evento fue manejado.
func (m *modelo) tecla(k string) (tea.Cmd, bool) {
	if k == "ctrl+c" {
		return tea.Quit, true
	}
	if k == "q" && !m.confirmar {
		return tea.Quit, true
	}

	switch m.vista {
	case vistaInicio:
		switch k {
		case "up", "k":
			if m.opcion > 0 {
				m.opcion--
			}
		case "down", "j":
			if m.opcion < len(etiquetasMenu)-1 {
				m.opcion++
			}
		case "enter", " ", "+":
			return m.activarOpcion()
		}
	case vistaEmparejar:
		switch k {
		case "esc":
			m.vista = vistaInicio
			m.sesion = nil
			m.aviso = ""
		case "c":
			if m.sesion != nil {
				return copiarCmd(m.sesion.Codigo), true
			}
		case "r":
			m.generar()
		}
	case vistaPuertos:
		switch k {
		case "esc":
			if m.confirmar {
				m.confirmar = false
			} else {
				m.vista = vistaInicio
			}
		case "up", "k":
			if m.seleccion > 0 {
				m.seleccion--
			}
		case "down", "j":
			if m.seleccion < len(m.puertos)-1 {
				m.seleccion++
			}
		case "r":
			return m.cargar(), true
		case "enter", "x", "d":
			if !m.cargando && len(m.puertos) > 0 {
				m.confirmar = true
			}
		case "s", "y":
			if m.confirmar && m.seleccionValida() {
				m.aviso = ""
				return matarCmd(m.puertos[m.seleccion]), true
			}
		case "n":
			if m.confirmar {
				m.confirmar = false
			}
		}
	}
	return nil, false
}

// activarOpcion ejecuta la entrada seleccionada del menú principal.
func (m *modelo) activarOpcion() (tea.Cmd, bool) {
	switch m.opcion {
	case opcionEmparejar:
		m.generar()
		return nil, true
	case opcionPuertos:
		m.vista = vistaPuertos
		return m.cargar(), true
	}
	return nil, false
}

func (m *modelo) raton(msg tea.MouseMsg) (tea.Cmd, bool) {
	switch m.vista {
	case vistaInicio:
		switch msg.Button {
		case tea.MouseButtonWheelUp:
			if m.opcion > 0 {
				m.opcion--
			}
		case tea.MouseButtonWheelDown:
			if m.opcion < len(etiquetasMenu)-1 {
				m.opcion++
			}
		case tea.MouseButtonLeft:
			if msg.Action != tea.MouseActionPress {
				return nil, false
			}
			y := msg.Y - m.offsetMenu()
			if y < 0 || y >= len(etiquetasMenu) {
				return nil, false
			}
			m.opcion = y
			return m.activarOpcion()
		}
	case vistaPuertos:
		if m.cargando || len(m.puertos) == 0 {
			return nil, false
		}
		switch msg.Button {
		case tea.MouseButtonWheelUp:
			if m.seleccion > 0 {
				m.seleccion--
			}
		case tea.MouseButtonWheelDown:
			if m.seleccion < len(m.puertos)-1 {
				m.seleccion++
			}
		case tea.MouseButtonLeft:
			if msg.Action != tea.MouseActionPress {
				return nil, false
			}
			y := msg.Y - m.offsetFilas()
			if y < 0 || y >= len(m.puertos) {
				return nil, false
			}
			if y == m.seleccion {
				m.confirmar = true
			} else {
				m.seleccion = y
				m.confirmar = false
			}
		}
	}
	return nil, false
}

func (m *modelo) seleccionValida() bool {
	return m.seleccion >= 0 && m.seleccion < len(m.puertos) && m.puertos[m.seleccion].PID > 0
}

// cargar dispara la lectura de puertos y activa el indicador de carga.
func (m *modelo) cargar() tea.Cmd {
	m.cargando = true
	m.aviso = ""
	return tea.Batch(cargarPuertosCmd(), tickSpinner())
}

// generar crea un código nuevo y dibuja su QR.
func (m *modelo) generar() {
	s, err := m.gestor.Nueva()
	if err != nil {
		m.aviso = "error: " + err.Error()
		m.tipoAviso = avisoError
		return
	}

	datos, _ := json.Marshal(map[string]any{
		"host":  m.ip,
		"port":  puertoServidor,
		"token": s.Token,
	})

	q, err := qrcode.New(string(datos), qrcode.Low)
	if err != nil {
		m.aviso = "error: " + err.Error()
		m.tipoAviso = avisoError
		return
	}

	m.sesion = s
	m.qr = dibujarQR(q.Bitmap())
	m.vista = vistaEmparejar
	m.recienGenerado = true
	m.aviso = ""
}

// dibujarQR convierte la matriz del QR en texto. Usa medios bloques para
// meter dos filas del QR en una línea de la terminal.
func dibujarQR(mapa [][]bool) string {
	var lineas []string
	for y := 0; y < len(mapa); y += 2 {
		var b strings.Builder
		for x := 0; x < len(mapa[y]); x++ {
			arriba := mapa[y][x]
			abajo := false
			if y+1 < len(mapa) {
				abajo = mapa[y+1][x]
			}
			switch {
			case arriba && abajo:
				b.WriteString("█")
			case arriba:
				b.WriteString("▀")
			case abajo:
				b.WriteString("▄")
			default:
				b.WriteString(" ")
			}
		}
		lineas = append(lineas, estiloQR.Render(b.String()))
	}
	return strings.Join(lineas, "\n")
}

// ---------- vistas ----------

// View dibuja el estado actual como texto.
func (m *modelo) View() string {
	if m.ancho == 0 || m.alto == 0 {
		return ""
	}

	cabecera := m.cabecera()
	pie := m.pie()
	altoCentro := m.alto - lipgloss.Height(cabecera) - lipgloss.Height(pie)
	if altoCentro < 1 {
		altoCentro = 1
	}

	var cuerpo string
	switch m.vista {
	case vistaInicio:
		cuerpo = m.vistaInicio(altoCentro)
	case vistaEmparejar:
		cuerpo = m.vistaEmparejar(altoCentro)
	case vistaPuertos:
		cuerpo = m.vistaPuertos(altoCentro)
	}

	pantalla := lipgloss.JoinVertical(lipgloss.Left, cabecera, cuerpo, pie)
	return estiloFondo.Width(m.ancho).Height(m.alto).Render(pantalla)
}

// cabecera: marca a la izquierda, estado del servidor a la derecha.
func (m *modelo) cabecera() string {
	largo := m.ancho >= 72
	izq := estiloMarca.Render(" nine ")
	if largo {
		izq += estiloMarcaTenue.Render("Terminal Nine")
	}

	salud := estiloOk.Render("●")
	if largo {
		salud += " " + estiloTexto2.Render(fmt.Sprintf("%s:%d", m.ip, puertoServidor))
		if m.dispositivos > 0 {
			salud = estiloTexto2.Render(fmt.Sprintf("%d conectado(s)  ", m.dispositivos)) + salud
		}
	}

	hueco := max(1, m.ancho-lipgloss.Width(izq)-lipgloss.Width(salud)-2)
	fila := estiloCabecera.Width(m.ancho).Render(" " + izq + strings.Repeat(" ", hueco) + salud + " ")
	return lipgloss.JoinVertical(lipgloss.Left, fila, regla(m.ancho))
}

// pie: barra de ayuda contextual.
func (m *modelo) pie() string {
	var claves []string
	if m.ancho < 64 {
		switch {
		case m.vista == vistaInicio:
			claves = []string{"↑↓", "mover", "enter", "elegir"}
		case m.vista == vistaEmparejar:
			claves = []string{"c", "copiar", "esc", "volver"}
		case m.confirmar:
			claves = []string{"s", "sí", "n", "no"}
		default:
			claves = []string{"enter", "parar", "esc", "volver"}
		}
	} else {
		switch {
		case m.vista == vistaInicio:
			claves = []string{"↑↓", "mover", "enter", "seleccionar", "q", "salir"}
		case m.vista == vistaEmparejar:
			claves = []string{"c", "copiar", "r", "nuevo", "esc", "volver", "q", "salir"}
		case m.confirmar:
			claves = []string{"s", "sí, parar", "n", "cancelar"}
		default:
			claves = []string{"↑↓", "mover", "enter", "parar", "r", "recargar", "esc", "volver"}
		}
	}
	ayuda := lipgloss.PlaceHorizontal(m.ancho, lipgloss.Center, atajos(claves...))
	return lipgloss.JoinVertical(lipgloss.Left, regla(m.ancho), estiloBarra.Width(m.ancho).Render(ayuda))
}

// ---------- inicio (menú principal) ----------

func (m *modelo) conLogo() bool { return m.alto >= 16 }

func (m *modelo) cimaInicio() string {
	partes := []string{}
	if m.conLogo() {
		partes = append(partes, estiloLogo.Render(logo), "")
	}
	partes = append(partes,
		estiloTitulo.Render("Terminal Nine"),
		estiloDesc.Render("Gestiona tus puertos desde el móvil"),
		"",
	)
	return lipgloss.JoinVertical(lipgloss.Left, partes...)
}

func (m *modelo) menuInicio() string {
	filas := make([]string, len(etiquetasMenu))
	for i, et := range etiquetasMenu {
		if i == m.opcion {
			filas[i] = estiloMenuActivo.Render("▸ " + et)
		} else {
			filas[i] = estiloMenu.Render("  " + et)
		}
	}
	return lipgloss.JoinVertical(lipgloss.Left, filas...)
}

func (m *modelo) offsetMenu() int {
	return altoCabecera + lipgloss.Height(m.cimaInicio())
}

func (m *modelo) vistaInicio(alto int) string {
	cuerpo := lipgloss.JoinVertical(lipgloss.Left, m.cimaInicio(), m.menuInicio())
	if m.aviso != "" {
		cuerpo = lipgloss.JoinVertical(lipgloss.Left, cuerpo, "", m.renderAviso())
	}
	return lipgloss.Place(m.ancho, alto, lipgloss.Center, lipgloss.Top, cuerpo)
}

// ---------- emparejar ----------

func (m *modelo) vistaEmparejar(alto int) string {
	if m.sesion == nil || len(m.sesion.Codigo) < 6 {
		return lipgloss.Place(m.ancho, alto, lipgloss.Center, lipgloss.Center,
			estiloAviso.Render("no hay una sesión activa · pulsa esc"))
	}

	restante := max(0, time.Until(m.sesion.ExpiraEn))
	cuenta := fmt.Sprintf("%d:%02d", int(restante.Minutes()), int(restante.Seconds())%60)

	qr := m.qr
	panel := m.panelCodigo(cuenta, restante)
	qrAncho, qrAlto := lipgloss.Width(qr), lipgloss.Height(qr)
	panelAncho, panelAlto := lipgloss.Width(panel), lipgloss.Height(panel)

	var contenido string
	switch {
	case qrAncho+4+panelAncho <= m.ancho && qrAlto <= alto:
		// Lo ideal: QR y código lado a lado.
		contenido = lipgloss.JoinHorizontal(lipgloss.Center, qr, "    ", panel)
	case qrAncho <= m.ancho && qrAlto+2+panelAlto <= alto:
		// Si no cabe a lo ancho, el código va debajo del QR.
		contenido = lipgloss.JoinVertical(lipgloss.Center, qr, "", panel)
	case qrAncho <= m.ancho && qrAlto <= alto:
		// Solo el QR: es lo importante para emparejar.
		contenido = qr
	default:
		contenido = lipgloss.JoinVertical(lipgloss.Left, panel,
			"", estiloTexto2.Render("amplía la ventana para ver el QR"))
	}

	if m.aviso != "" {
		contenido = lipgloss.JoinVertical(lipgloss.Center, contenido, "", m.renderAviso())
	}
	return lipgloss.Place(m.ancho, alto, lipgloss.Center, lipgloss.Center, contenido)
}

func (m *modelo) panelCodigo(cuenta string, restante time.Duration) string {
	codigo := m.sesion.Codigo[:3] + " " + m.sesion.Codigo[3:]

	lineas := []string{
		estiloTexto2.Render("código"),
		estiloCodigo.Render(codigo),
		"",
		estiloTexto2.Render("expira en " + cuenta),
		barraTiempo(restante, TiempoVida, 18),
		"",
		estiloTexto2.Render("Escanea el QR o escribe el"),
		estiloTexto2.Render("código en la app del móvil."),
		"",
		estiloTexto2.Render(fmt.Sprintf("%s:%d", m.ip, puertoServidor)),
	}
	return lipgloss.JoinVertical(lipgloss.Left, lineas...)
}

// ---------- puertos ----------

func (m *modelo) cabeceraPuertos() []string {
	return []string{"", estiloTitulo.Render("Puertos en escucha"), estiloTexto2.Render(m.metaPuertos()), ""}
}

func (m *modelo) metaPuertos() string {
	switch {
	case m.cargando:
		return m.spinner() + " actualizando…"
	case len(m.puertos) == 0:
		return "no hay puertos TCP en escucha"
	default:
		return fmt.Sprintf("%d activo(s)", len(m.puertos))
	}
}

func (m *modelo) encabezadoPuertos() string {
	lineas := append(m.cabeceraPuertos(), m.encabezadoTabla(), regla(m.ancho))
	return lipgloss.JoinVertical(lipgloss.Left, lineas...)
}

// offsetFilas devuelve la línea de pantalla de la primera fila de la tabla.
func (m *modelo) offsetFilas() int {
	return altoCabecera + lipgloss.Height(m.encabezadoPuertos())
}

func (m *modelo) vistaPuertos(alto int) string {
	var lineas []string

	if m.cargando {
		lineas = append(lineas, m.spinner()+" consultando puertos…")
	} else if len(m.puertos) == 0 {
		lineas = append(lineas, estiloInactivo.Render("○  sin resultados"))
	} else {
		for i, p := range m.puertos {
			lineas = append(lineas, m.filaTabla(p, i == m.seleccion))
		}
	}

	// Los mensajes van al final para no mover las filas.
	if m.confirmar && m.seleccionValida() {
		p := m.puertos[m.seleccion]
		lineas = append(lineas, "",
			estiloAviso.Render(fmt.Sprintf("¿Parar «%s» (PID %d) en el puerto %d?  s/n", p.Proceso, p.PID, p.Puerto)))
	}
	if m.aviso != "" {
		lineas = append(lineas, "", m.renderAviso())
	}

	bloque := lipgloss.JoinVertical(lipgloss.Left, m.encabezadoPuertos(), strings.Join(lineas, "\n"))
	return lipgloss.Place(m.ancho, alto, lipgloss.Center, lipgloss.Top, bloque)
}

func (m *modelo) encabezadoTabla() string {
	wPuerto, wProceso, wPid, wEstado := columnasPuertos(m.ancho)
	fila := fmt.Sprintf(" %-*s %-*s %-*s %-*s",
		wPuerto, "PUERTO", wProceso, "PROCESO", wPid, "PID", wEstado, "ESTADO")
	return estiloTexto2.Render(fila)
}

func (m *modelo) filaTabla(p Puerto, seleccionada bool) string {
	wPuerto, wProceso, wPid, wEstado := columnasPuertos(m.ancho)

	pid := "—"
	if p.PID > 0 {
		pid = fmt.Sprint(p.PID)
	}

	estadoTexto, estiloEstado := "● activo", estiloOk
	if p.PID <= 0 {
		estadoTexto, estiloEstado = "○ desconocido", estiloInactivo
	}

	if seleccionada {
		fila := fmt.Sprintf(" %-*s %-*s %-*s %-*s",
			wPuerto, fmt.Sprint(p.Puerto),
			wProceso, recortar(p.Proceso, wProceso),
			wPid, pid,
			wEstado, "▸ parar")
		return estiloFilaSeleccion.Width(m.ancho).Render(fila)
	}

	fila := fmt.Sprintf(" %-*s %-*s %-*s %s",
		wPuerto, fmt.Sprint(p.Puerto),
		wProceso, recortar(p.Proceso, wProceso),
		wPid, pid,
		estiloEstado.Render(estadoTexto))
	return estiloFondo.Render(fila)
}

func columnasPuertos(ancho int) (wPuerto, wProceso, wPid, wEstado int) {
	wPuerto, wPid, wEstado = 8, 8, 14
	wProceso = ancho - (1 + wPuerto + wPid + wEstado + 3)
	if wProceso < 10 {
		wProceso = 10
	}
	return
}

func (m *modelo) spinner() string {
	return estiloTecla.Render(framesSpinner[m.frame])
}

func (m *modelo) renderAviso() string {
	est, icono := estiloAviso, "◆"
	switch m.tipoAviso {
	case avisoOk:
		est, icono = estiloOk, "✓"
	case avisoError:
		est, icono = estiloError, "✕"
	}
	return est.Render(icono + " " + m.aviso)
}

// ---------- utilidades ----------

const altoCabecera = 2 // fila + regla

func regla(ancho int) string {
	return lipgloss.NewStyle().Foreground(colBorde).Background(colFondo).
		Render(strings.Repeat("─", max(1, ancho)))
}

func atajos(pares ...string) string {
	var partes []string
	for i := 0; i+1 < len(pares); i += 2 {
		partes = append(partes, estiloTecla.Render(pares[i])+" "+estiloTexto2.Render(pares[i+1]))
	}
	return strings.Join(partes, estiloTexto2.Render("  ·  "))
}

// barraTiempo dibuja el tiempo restante como una barra que cambia de color.
func barraTiempo(restante, total time.Duration, ancho int) string {
	if ancho < 1 {
		ancho = 1
	}
	frac := min(1, max(0, float64(restante)/float64(total)))
	lleno := int(frac*float64(ancho) + 0.5)

	color := colOk
	switch {
	case frac < 0.34:
		color = colError
	case frac < 0.67:
		color = colAviso
	}

	return lipgloss.NewStyle().Foreground(color).Render(strings.Repeat("█", lleno)) +
		lipgloss.NewStyle().Foreground(colBorde).Render(strings.Repeat("░", ancho-lleno))
}

func recortar(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return string(r[:max(0, n)])
	}
	return string(r[:n-1]) + "…"
}

// ---------- arranque ----------

// obtenerIP devuelve la IP de tu laptop en la red local.
// Abrir un "UDP" no envía nada, solo le pregunta al sistema qué interfaz usaría.
func obtenerIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}

func ejecutarTUI() {
	gestor := NuevoGestor()
	srv := NuevoServidor(gestor)

	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", puertoServidor))
	if err != nil {
		fmt.Fprintf(os.Stderr, "no se pudo abrir el puerto %d (¿ya hay un nine abierto?): %v\n", puertoServidor, err)
		os.Exit(1)
	}

	m := &modelo{gestor: gestor, ip: obtenerIP(), cargando: true}
	p := tea.NewProgram(m, tea.WithAltScreen(), tea.WithMouseCellMotion())

	// Cuando el servidor empareja a alguien, avisa al TUI.
	srv.AlEmparejar = func() { p.Send(emparejadoMsg{}) }
	// Al generar un código nuevo se desconectan los dispositivos.
	gestor.AlNueva = srv.CerrarSesiones

	go srv.Servir(ln)

	// Los cambios de puertos llegan en tiempo real (incluidos los que mata la app).
	canal, cancelarCanal := srv.SuscribirPuertos()
	defer cancelarCanal()
	go func() {
		for ev := range canal {
			if ev.Cerrar {
				p.Send(sesionCerradaMsg{})
			} else {
				p.Send(puertosMsg(ev.Puertos))
			}
		}
	}()

	if _, err := p.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}
