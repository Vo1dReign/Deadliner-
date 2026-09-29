using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Deadliner.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Klienty",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FioNazvanie = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Telefon = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AdresObekta = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Klienty", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PorogiSrochnosti",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Cvet = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DneyOt = table.Column<int>(type: "int", nullable: false),
                    DneyDo = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PorogiSrochnosti", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roli",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nazvanie = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roli", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EtapYProizvodstva",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nazvanie = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PoryadkovyNomer = table.Column<int>(type: "int", nullable: false),
                    TipEtapa = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IdRoliOtvetstvennogo = table.Column<int>(type: "int", nullable: true),
                    RolOtvetstvennogoId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EtapYProizvodstva", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EtapYProizvodstva_Roli_RolOtvetstvennogoId",
                        column: x => x.RolOtvetstvennogoId,
                        principalTable: "Roli",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Sotrudniki",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Fio = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Telefon = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IdRoli = table.Column<int>(type: "int", nullable: false),
                    Login = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Parol = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RolId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sotrudniki", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sotrudniki_Roli_RolId",
                        column: x => x.RolId,
                        principalTable: "Roli",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Zakazy",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdKlienta = table.Column<int>(type: "int", nullable: false),
                    IdMenedzhera = table.Column<int>(type: "int", nullable: false),
                    DataPriema = table.Column<DateOnly>(type: "date", nullable: false),
                    SummaPredoplaty = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PlanDataOtgruzki = table.Column<DateOnly>(type: "date", nullable: false),
                    FactDataOtgruzki = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    KlientId = table.Column<int>(type: "int", nullable: false),
                    MenedzherId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Zakazy", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Zakazy_Klienty_KlientId",
                        column: x => x.KlientId,
                        principalTable: "Klienty",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Zakazy_Sotrudniki_MenedzherId",
                        column: x => x.MenedzherId,
                        principalTable: "Sotrudniki",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EtapyZakazov",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdZakaza = table.Column<int>(type: "int", nullable: false),
                    IdEtapa = table.Column<int>(type: "int", nullable: false),
                    IdSotrudnika = table.Column<int>(type: "int", nullable: true),
                    PlanData = table.Column<DateOnly>(type: "date", nullable: false),
                    FactData = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ZakazId = table.Column<int>(type: "int", nullable: false),
                    EtapId = table.Column<int>(type: "int", nullable: false),
                    SotrudnikId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EtapyZakazov", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EtapyZakazov_EtapYProizvodstva_EtapId",
                        column: x => x.EtapId,
                        principalTable: "EtapYProizvodstva",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EtapyZakazov_Sotrudniki_SotrudnikId",
                        column: x => x.SotrudnikId,
                        principalTable: "Sotrudniki",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_EtapyZakazov_Zakazy_ZakazId",
                        column: x => x.ZakazId,
                        principalTable: "Zakazy",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Izdeliya",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdZakaza = table.Column<int>(type: "int", nullable: false),
                    Naimenovanie = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Kolichestvo = table.Column<int>(type: "int", nullable: false),
                    Harakteristiki = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ZakazId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Izdeliya", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Izdeliya_Zakazy_ZakazId",
                        column: x => x.ZakazId,
                        principalTable: "Zakazy",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ZhurnalIzmenenii",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IdZakaza = table.Column<int>(type: "int", nullable: false),
                    IdSotrudnika = table.Column<int>(type: "int", nullable: false),
                    DataIzmenenia = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OpisanieIzmenenia = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ZhurnalIzmenenii", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ZhurnalIzmenenii_Sotrudniki_IdSotrudnika",
                        column: x => x.IdSotrudnika,
                        principalTable: "Sotrudniki",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ZhurnalIzmenenii_Zakazy_IdZakaza",
                        column: x => x.IdZakaza,
                        principalTable: "Zakazy",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EtapYProizvodstva_RolOtvetstvennogoId",
                table: "EtapYProizvodstva",
                column: "RolOtvetstvennogoId");

            migrationBuilder.CreateIndex(
                name: "IX_EtapyZakazov_EtapId",
                table: "EtapyZakazov",
                column: "EtapId");

            migrationBuilder.CreateIndex(
                name: "IX_EtapyZakazov_SotrudnikId",
                table: "EtapyZakazov",
                column: "SotrudnikId");

            migrationBuilder.CreateIndex(
                name: "IX_EtapyZakazov_ZakazId",
                table: "EtapyZakazov",
                column: "ZakazId");

            migrationBuilder.CreateIndex(
                name: "IX_Izdeliya_ZakazId",
                table: "Izdeliya",
                column: "ZakazId");

            migrationBuilder.CreateIndex(
                name: "IX_Sotrudniki_RolId",
                table: "Sotrudniki",
                column: "RolId");

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_KlientId",
                table: "Zakazy",
                column: "KlientId");

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_MenedzherId",
                table: "Zakazy",
                column: "MenedzherId");

            migrationBuilder.CreateIndex(
                name: "IX_ZhurnalIzmenenii_IdSotrudnika",
                table: "ZhurnalIzmenenii",
                column: "IdSotrudnika");

            migrationBuilder.CreateIndex(
                name: "IX_ZhurnalIzmenenii_IdZakaza",
                table: "ZhurnalIzmenenii",
                column: "IdZakaza");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EtapyZakazov");

            migrationBuilder.DropTable(
                name: "Izdeliya");

            migrationBuilder.DropTable(
                name: "PorogiSrochnosti");

            migrationBuilder.DropTable(
                name: "ZhurnalIzmenenii");

            migrationBuilder.DropTable(
                name: "EtapYProizvodstva");

            migrationBuilder.DropTable(
                name: "Zakazy");

            migrationBuilder.DropTable(
                name: "Klienty");

            migrationBuilder.DropTable(
                name: "Sotrudniki");

            migrationBuilder.DropTable(
                name: "Roli");
        }
    }
}
