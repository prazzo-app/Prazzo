import flet as ft
import requests

def LoginView(page: ft.Page):
    # Premium Colors
    PRIMARY_COLOR = "#D4AF37" # Gold
    BG_COLOR = "#0A192F"      # Dark Navy Blue
    CARD_BG = "#112240"
    API_URL = "http://127.0.0.1:8000"

    email_input = ft.TextField(label="Email", bgcolor=CARD_BG, color=ft.colors.WHITE, border_color=PRIMARY_COLOR)
    password_input = ft.TextField(label="Senha", password=True, can_reveal_password=True, bgcolor=CARD_BG, color=ft.colors.WHITE, border_color=PRIMARY_COLOR)

    def show_error(message):
        page.snack_bar = ft.SnackBar(ft.Text(message, color=ft.colors.WHITE), bgcolor=ft.colors.RED_700)
        page.snack_bar.open = True
        page.update()

    def show_success(message):
        page.snack_bar = ft.SnackBar(ft.Text(message, color=ft.colors.WHITE), bgcolor=ft.colors.GREEN_700)
        page.snack_bar.open = True
        page.update()

    def login_clicked(e):
        email = email_input.value
        password = password_input.value
        if not email or not password:
            show_error("Preencha todos os campos")
            return
            
        try:
            # We are using UserCreate schema locally which expects email and password
            response = requests.post(f"{API_URL}/users/login", json={"email": email, "password": password})
            if response.status_code == 200:
                data = response.json()
                page.session.set("user_id", data["user_id"])
                page.session.set("user_email", data["email"])
                page.go("/dashboard")
            else:
                show_error(response.json().get("detail", "Erro ao fazer login"))
        except Exception as ex:
            show_error("Erro ao conectar à API")

    def register_clicked(e):
        email = email_input.value
        password = password_input.value
        if not email or not password:
            show_error("Preencha todos os campos")
            return
            
        try:
            response = requests.post(f"{API_URL}/users/", json={"email": email, "password": password})
            if response.status_code == 200:
                show_success("Conta criada! Faça login.")
            else:
                show_error(response.json().get("detail", "Erro ao criar conta"))
        except Exception as ex:
            show_error("Erro ao conectar à API")

    return ft.View(
        "/login",
        bgcolor=BG_COLOR,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        vertical_alignment=ft.MainAxisAlignment.CENTER,
        controls=[
            ft.Container(
                width=400,
                padding=40,
                bgcolor=CARD_BG,
                border_radius=15,
                border=ft.border.all(1, PRIMARY_COLOR),
                content=ft.Column(
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    controls=[
                        ft.Icon(ft.icons.GAVEL, size=60, color=PRIMARY_COLOR),
                        ft.Text("Prazzo", size=40, color=PRIMARY_COLOR, weight=ft.FontWeight.BOLD),
                        ft.Text("Agenda Jurídica Inteligente", size=16, color=ft.colors.WHITE70),
                        ft.Container(height=30),
                        email_input,
                        password_input,
                        ft.Container(height=20),
                        ft.ElevatedButton(
                            text="Entrar",
                            width=300,
                            bgcolor=PRIMARY_COLOR,
                            color=BG_COLOR,
                            on_click=login_clicked,
                        ),
                        ft.TextButton("Criar Conta", style=ft.ButtonStyle(color=PRIMARY_COLOR), on_click=register_clicked)
                    ]
                )
            )
        ]
    )
