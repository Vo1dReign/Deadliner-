using Microsoft.EntityFrameworkCore;
using Deadliner.API.Models;

namespace Deadliner.API.Data;
public class DeadlinerContext : DbContext
{
    public DeadlinerContext(DbContextOptions<DeadlinerContext> options): base(options)
    {
        
    }
    public DbSet<Rol> Roli {get; set;}
    public DbSet<Sotrudnik> Sotrudniki {get; set;}
    public DbSet<Klient> Klienty {get; set;}
    public DbSet<Zakaz> Zakazy {get; set;}
    public DbSet<Izdelie> Izdeliya {get; set;}
    public DbSet<EtapProizvodstva> EtapYProizvodstva {get; set;}
    public DbSet<EtapZakaza> EtapyZakazov  {get; set;}
    public DbSet<PorogSrochnosti> PorogiSrochnosti {get; set;}
    public DbSet<ZhurnalIzmenenii> ZhurnalIzmenenii {get; set;}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ZhurnalIzmenenii>()
        .HasOne(z=> z.Zakaz)
        .WithMany(z => z.ZhurnalIzmenenii)
        .HasForeignKey(z => z.IdZakaza)
        .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ZhurnalIzmenenii>()
        .HasOne(z => z.Sotrudnik)
        .WithMany(z => z.ZhurnalIzmenenii)
        .HasForeignKey(z => z.IdSotrudnika)
        .OnDelete(DeleteBehavior.Restrict);
    }

}


