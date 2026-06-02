import flet as ft
import requests
import datetime

def AgendaView(page: ft.Page):
    PRIMARY_COLOR = "#D4AF37"
    BG_COLOR = "#0A192F"
    CARD_BG = "#112240"
    API_URL = "http://127.0.0.1:8000"

    user_id = page.session.get("user_id")

    appointments_list = ft.ListView(expand=1, spacing=10, padding=20)

    # Inputs for new appointment
    title_input = ft.TextField(label="Título (ex: Cliente João)", bgcolor=BG_COLOR, color=ft.colors.WHITE)
    type_dropdown = ft.Dropdown(
        label="Tipo",
        bgcolor=BG_COLOR,
        color=ft.colors.WHITE,
        options=[
            ft.dropdown.Option("Cliente"),
            ft.dropdown.Option("Audiência"),
            ft.dropdown.Option("Diligência"),
            ft.dropdown.Option("Outro"),
        ],
        value="Cliente"
    )
    # Simple text field for datetime for MVP. A proper implementation would use a DatePicker.
    date_input = ft.TextField(label="Data (AAAA-MM-DD HH:MM)", value=datetime.datetime.now().strftime("%Y-%m-%d %H:00"), bgcolor=BG_COLOR, color=ft.colors.WHITE)

    def show_error(message):
        page.snack_bar = ft.SnackBar(ft.Text(message, color=ft.colors.WHITE), bgcolor=ft.colors.RED_700)
        page.snack_bar.open = True
        page.update()

    def load_appointments():
        if not user_id: return
        try:
            response = requests.get(f"{API_URL}/agenda/", params={"user_id": user_id})
            if response.status_code == 200:
                appointments_list.controls.clear()
                data = response.json()
                if not data:
                    appointments_list.controls.append(ft.Text("Nenhum compromisso agendado.", color=ft.colors.WHITE70))
                for appt in data:
                    icon_type = ft.icons.PERSON if appt["appointment_type"] == "Cliente" else ft.icons.BUSINESS_CENTER if appt["appointment_type"] == "Diligência" else ft.icons.GAVEL
                    appointments_list.controls.append(
                        ft.Container(
                            bgcolor=CARD_BG,
                            padding=15,
                            border_radius=10,
                            border=ft.border.only(left=ft.border.BorderSide(4, PRIMARY_COLOR)),
                            content=ft.Row([
                                ft.Icon(icon_type, color=PRIMARY_COLOR),
                                ft.Column([
                                    ft.Text(appt["title"], color=ft.colors.WHITE, weight=ft.FontWeight.BOLD),
                                    ft.Text(f"{appt['date_time'].replace('T', ' ')}", color=ft.colors.WHITE70, size=12),
                                ])
                            ])
                        )
                    )
                page.update()
        except Exception as e:
            show_error("Erro ao carregar compromissos")

    def add_appointment(e):
        try:
            # Parse simple date format
            formatted_date = datetime.datetime.strptime(date_input.value, "%Y-%m-%d %H:%M").isoformat()
        except ValueError:
            show_error("Formato de data inválido.")
            return

        payload = {
            "title": title_input.value,
            "appointment_type": type_dropdown.value,
            "date_time": formatted_date,
            "description": ""
        }
        
        try:
            response = requests.post(f"{API_URL}/agenda/", params={"user_id": user_id}, json=payload)
            if response.status_code == 200:
                title_input.value = ""
                load_appointments()
                # Close bottom sheet
                bs.open = False
                page.update()
            else:
                show_error("Erro ao salvar compromisso.")
        except Exception as ex:
            show_error("Erro de conexão.")

    # Bottom sheet for creating appointments
    bs = ft.BottomSheet(
        ft.Container(
            padding=30,
            bgcolor=CARD_BG,
            content=ft.Column(
                tight=True,
                controls=[
                    ft.Text("Novo Compromisso", size=20, color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                    title_input,
                    type_dropdown,
                    date_input,
                    ft.ElevatedButton("Salvar", bgcolor=PRIMARY_COLOR, color=BG_COLOR, on_click=add_appointment, width=300)
                ]
            ),
        ),
    )
    page.overlay.append(bs)

    def show_add_modal(e):
        bs.open = True
        page.update()

    def go_back(e):
        page.go("/dashboard")

    # Load initial data
    load_appointments()

    return ft.View(
        "/agenda",
        bgcolor=BG_COLOR,
        controls=[
            ft.AppBar(
                leading=ft.IconButton(ft.icons.ARROW_BACK, icon_color=PRIMARY_COLOR, on_click=go_back),
                title=ft.Text("Minha Agenda", color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                bgcolor=CARD_BG,
            ),
            appointments_list,
            ft.FloatingActionButton(
                icon=ft.icons.ADD,
                bgcolor=PRIMARY_COLOR,
                on_click=show_add_modal
            )
        ]
    )
