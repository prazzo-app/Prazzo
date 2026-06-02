import flet as ft
import requests

def ProcessesView(page: ft.Page):
    PRIMARY_COLOR = "#D4AF37"
    BG_COLOR = "#0A192F"
    CARD_BG = "#112240"
    API_URL = "http://127.0.0.1:8000"

    user_id = page.session.get("user_id")

    processes_list = ft.ListView(expand=1, spacing=10, padding=20)

    # Inputs for new process
    cnj_input = ft.TextField(label="Número CNJ (Ex: 0000000-00.0000.0.00.0000)", bgcolor=BG_COLOR, color=ft.colors.WHITE)
    court_input = ft.TextField(label="Tribunal (Ex: TJSP)", bgcolor=BG_COLOR, color=ft.colors.WHITE)

    def show_error(message):
        page.snack_bar = ft.SnackBar(ft.Text(message, color=ft.colors.WHITE), bgcolor=ft.colors.RED_700)
        page.snack_bar.open = True
        page.update()
        
    def show_success(message):
        page.snack_bar = ft.SnackBar(ft.Text(message, color=ft.colors.WHITE), bgcolor=ft.colors.GREEN_700)
        page.snack_bar.open = True
        page.update()

    def load_processes():
        if not user_id: return
        try:
            response = requests.get(f"{API_URL}/processes/", params={"user_id": user_id})
            if response.status_code == 200:
                processes_list.controls.clear()
                data = response.json()
                if not data:
                    processes_list.controls.append(ft.Text("Nenhum processo sendo monitorado.", color=ft.colors.WHITE70))
                for proc in data:
                    processes_list.controls.append(
                        ft.Container(
                            bgcolor=CARD_BG,
                            padding=15,
                            border_radius=10,
                            border=ft.border.only(left=ft.border.BorderSide(4, PRIMARY_COLOR)),
                            content=ft.Row([
                                ft.Icon(ft.icons.ACCOUNT_BALANCE, color=PRIMARY_COLOR),
                                ft.Column([
                                    ft.Text(proc["cnj_number"], color=ft.colors.WHITE, weight=ft.FontWeight.BOLD),
                                    ft.Text(f"Tribunal: {proc['court']}", color=ft.colors.WHITE70, size=12),
                                ])
                            ])
                        )
                    )
                page.update()
        except Exception as e:
            show_error("Erro ao carregar processos")

    def add_process(e):
        if not cnj_input.value or not court_input.value:
            show_error("Insira o CNJ e o Tribunal.")
            return

        payload = {
            "cnj_number": cnj_input.value,
            "court": court_input.value,
        }
        
        try:
            response = requests.post(f"{API_URL}/processes/", params={"user_id": user_id}, json=payload)
            if response.status_code == 200:
                cnj_input.value = ""
                court_input.value = ""
                load_processes()
                bs.open = False
                show_success("Processo cadastrado para monitoramento!")
                page.update()
            else:
                show_error(response.json().get("detail", "Erro ao salvar processo."))
        except Exception as ex:
            show_error("Erro de conexão.")

    # Bottom sheet for creating process tracking
    bs = ft.BottomSheet(
        ft.Container(
            padding=30,
            bgcolor=CARD_BG,
            content=ft.Column(
                tight=True,
                controls=[
                    ft.Text("Adicionar Processo", size=20, color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                    ft.Text("O acompanhamento consumirá sua cota gratuita.", size=12, color=ft.colors.WHITE70),
                    cnj_input,
                    court_input,
                    ft.ElevatedButton("Começar a Monitorar", bgcolor=PRIMARY_COLOR, color=BG_COLOR, on_click=add_process, width=300)
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
    load_processes()

    return ft.View(
        "/processes",
        bgcolor=BG_COLOR,
        controls=[
            ft.AppBar(
                leading=ft.IconButton(ft.icons.ARROW_BACK, icon_color=PRIMARY_COLOR, on_click=go_back),
                title=ft.Text("Processos Monitorados", color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                bgcolor=CARD_BG,
            ),
            processes_list,
            ft.FloatingActionButton(
                icon=ft.icons.ADD,
                bgcolor=PRIMARY_COLOR,
                on_click=show_add_modal
            )
        ]
    )
