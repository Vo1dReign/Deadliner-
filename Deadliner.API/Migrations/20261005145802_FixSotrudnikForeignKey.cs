using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Deadliner.API.Migrations
{
    /// <inheritdoc />
    public partial class FixSotrudnikForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sotrudniki_Roli_RolId",
                table: "Sotrudniki");

            migrationBuilder.DropIndex(
                name: "IX_Sotrudniki_RolId",
                table: "Sotrudniki");

            migrationBuilder.DropColumn(
                name: "RolId",
                table: "Sotrudniki");

            migrationBuilder.CreateIndex(
                name: "IX_Sotrudniki_IdRoli",
                table: "Sotrudniki",
                column: "IdRoli");

            migrationBuilder.AddForeignKey(
                name: "FK_Sotrudniki_Roli_IdRoli",
                table: "Sotrudniki",
                column: "IdRoli",
                principalTable: "Roli",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Sotrudniki_Roli_IdRoli",
                table: "Sotrudniki");

            migrationBuilder.DropIndex(
                name: "IX_Sotrudniki_IdRoli",
                table: "Sotrudniki");

            migrationBuilder.AddColumn<int>(
                name: "RolId",
                table: "Sotrudniki",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Sotrudniki_RolId",
                table: "Sotrudniki",
                column: "RolId");

            migrationBuilder.AddForeignKey(
                name: "FK_Sotrudniki_Roli_RolId",
                table: "Sotrudniki",
                column: "RolId",
                principalTable: "Roli",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
