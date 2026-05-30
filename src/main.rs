use clap::Parser;
use copperhead::cli::{Cli, Commands};

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Init { ref name } => copperhead::cli::init::run(name),
        Commands::Build => copperhead::cli::build::run(),
        Commands::Run => copperhead::cli::run::run(),
        Commands::Check => copperhead::cli::check::run(),
        Commands::Transpile { ref file } => copperhead::cli::transpile::run(file),
    };

    if let Err(e) = result {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
