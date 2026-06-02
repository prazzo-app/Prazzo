import flet as ft
import requests
import datetime

def DashboardView(page: ft.Page):
    # Colors for premium look
    PRIMARY_COLOR = "#D4AF37" # Gold
    BG_COLOR = "#0A192F"      # Dark Navy Blue
    CARD_BG = "#112240"
    API_URL = "http://127.0.0.1:8000"

    user_id = page.session.get("user_id")
    user_email = page.session.get("user_email", "Advogado(a)")

    def logout_clicked(e):
        page.session.clear()
        page.go("/login")

    def go_agenda(e):
        page.go("/agenda")

    def go_processes(e):
        page.go("/processes")

    # Container to hold today's appointments dynamically
    appointments_container = ft.Column()

    def load_todays_appointments():
        if not user_id: return
        try:
            # We are using basic GET /agenda/ which returns everything. In a real app we'd filter.
            response = requests.get(f"{API_URL}/agenda/", params={"user_id": user_id})
            if response.status_code == 200:
                data = response.json()
                appointments_container.controls.clear()
                
                # Filter for simple display
                today_str = datetime.datetime.now().strftime("%Y-%m-%d")
                todays = [a for a in data if a["date_time"].startswith(today_str)]
                
                if not todays:
                    appointments_container.controls.append(ft.Text("Nenhum compromisso marcado para hoje.", color=ft.colors.WHITE70))
                else:
                    for appt in todays:
                        time_str = appt["date_time"].split("T")[1][:5]
                        appointments_container.controls.append(
                            ft.Container(
                                bgcolor=CARD_BG,
                                padding=15,
                                border_radius=10,
                                content=ft.Row([
                                    ft.Icon(ft.icons.EVENT, color=PRIMARY_COLOR),
                                    ft.Text(f"{appt['title']} - {time_str}", color=ft.colors.WHITE),
                                ])
                            )
                        )
                page.update()
        except:
            pass

    load_todays_appointments()

    return ft.View(
        "/dashboard",
        bgcolor=BG_COLOR,
        controls=[
            ft.AppBar(
                title=ft.Text("Prazzo", color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                bgcolor=CARD_BG,
                actions=[
                    ft.IconButton(ft.icons.LOGOUT, icon_color=PRIMARY_COLOR, on_click=logout_clicked),
                ]
            ),
            ft.Container(
                padding=20,
                content=ft.Column(
                    controls=[
                        ft.Text(f"Bem-vindo, {user_email.split('@')[0]}!", size=30, color=PRIMARY_COLOR, weight=ft.FontWeight.W_600),
                        ft.Divider(color=PRIMARY_COLOR),
                        # Próximos Compromissos Section
                        ft.Row([
                            ft.Text("Compromissos de Hoje", size=20, color=ft.colors.WHITE70),
                            ft.IconButton(ft.icons.OPEN_IN_NEW, icon_color=PRIMARY_COLOR, tooltip="Abrir Agenda", on_click=go_agenda)
                        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                        appointments_container,
                        
                        # Alertas de Prazos Section
                        ft.Container(height=20),
                        ft.Row([
                            ft.Text("Prazos Iminentes (Processos)", size=20, color=ft.colors.WHITE70),
                            ft.IconButton(ft.icons.ACCOUNT_BALANCE, icon_color=PRIMARY_COLOR, tooltip="Meus Processos", on_click=go_processes)
                        ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                        ft.Container(
                            bgcolor=CARD_BG,
                            padding=15,
                            border_radius=10,
                            content=ft.Column([
                                ft.Row([
                                    ft.Icon(ft.icons.WARNING_AMBER_ROUNDED, color=ft.colors.RED_400),
                                    ft.Text("Processo 0012345-67.2023.8.26.0000", color=ft.colors.WHITE, weight=ft.FontWeight.BOLD),
                                ]),
                                ft.Text("Prazo para contestação em 2 dias.", color=ft.colors.WHITE70),
                                ft.ElevatedButton("Atualizar para o Premium (WhatsApp)", 
                                                color=BG_COLOR, bgcolor=PRIMARY_COLOR, icon=ft.icons.ROCKET_LAUNCH)
                            ])
                        )
                    ]
                )
            )
        ]
    )
