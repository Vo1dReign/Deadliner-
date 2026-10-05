using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Deadliner.API.Migrations
{
    /// <inheritdoc />
    public partial class FixZakazForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Zakazy_Klienty_KlientId",
                table: "Zakazy");

            migrationBuilder.DropForeignKey(
                name: "FK_Zakazy_Sotrudniki_MenedzherId",
                table: "Zakazy");

            migrationBuilder.DropIndex(
                name: "IX_Zakazy_KlientId",
                table: "Zakazy");

            migrationBuilder.DropIndex(
                name: "IX_Zakazy_MenedzherId",
                table: "Zakazy");

            migrationBuilder.DropColumn(
                name: "KlientId",
                table: "Zakazy");

            migrationBuilder.DropColumn(
                name: "MenedzherId",
                table: "Zakazy");

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_IdKlienta",
                table: "Zakazy",
                column: "IdKlienta");

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_IdMenedzhera",
                table: "Zakazy",
                column: "IdMenedzhera");

            migrationBuilder.AddForeignKey(
                name: "FK_Zakazy_Klienty_IdKlienta",
                table: "Zakazy",
                column: "IdKlienta",
                principalTable: "Klienty",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Zakazy_Sotrudniki_IdMenedzhera",
                table: "Zakazy",
                column: "IdMenedzhera",
                principalTable: "Sotrudniki",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Zakazy_Klienty_IdKlienta",
                table: "Zakazy");

            migrationBuilder.DropForeignKey(
                name: "FK_Zakazy_Sotrudniki_IdMenedzhera",
                table: "Zakazy");

            migrationBuilder.DropIndex(
                name: "IX_Zakazy_IdKlienta",
                table: "Zakazy");

            migrationBuilder.DropIndex(
                name: "IX_Zakazy_IdMenedzhera",
                table: "Zakazy");

            migrationBuilder.AddColumn<int>(
                name: "KlientId",
                table: "Zakazy",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MenedzherId",
                table: "Zakazy",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_KlientId",
                table: "Zakazy",
                column: "KlientId");

            migrationBuilder.CreateIndex(
                name: "IX_Zakazy_MenedzherId",
                table: "Zakazy",
                column: "MenedzherId");

            migrationBuilder.AddForeignKey(
                name: "FK_Zakazy_Klienty_KlientId",
                table: "Zakazy",
                column: "KlientId",
                principalTable: "Klienty",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Zakazy_Sotrudniki_MenedzherId",
                table: "Zakazy",
                column: "MenedzherId",
                principalTable: "Sotrudniki",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
